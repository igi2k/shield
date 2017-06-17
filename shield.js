// dependencies
const express = require("express");
const path = require("path");

// express middleware
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
// templating engine
const htmlEngine = require("gaikan");

var app = express();

/**
 * express configuration
 */
app.use(cookieParser());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", ".html");
app.engine("html", htmlEngine);

app.use("/static", express.static(path.join(__dirname, "static")));

var config = loadConfig();

var ShieldProxy = require("./lib/shield-proxy");
var ShieldAccess = require("./lib/shield-access");
var AuthService = require("./lib/auth-service");
var authService = AuthService(app);
var shieldAuth = [require("./lib/check-auth")(authService), require("./lib/auth/basic-auth")(authService)];

// setup html engine helpers
// TODO: make single param function
htmlEngine.set["hasRole"] = function (auth, role) {
    return role == undefined || auth && auth.hasRole(role);
};

// setup access
app.keys = config.keys;
app.locals.users = config.users;
// exposed api
app.locals.api = {
    stm: require("./lib/stm"),
    queue: require("./lib/stm-queue")
};
// logging
const ipLookup = config["ip-lookup"] || {};
morgan.token("remote-addr-lookup", function(req){
    var ip = this["remote-addr"](req);
    return ipLookup[ip] || ip;
});

function loadConfig(){
    var fileName = path.join(__dirname, "root", "config.json");
    return require(fileName);
}

function createShield(app){
    var shieldMapping = express.Router();
    // shield authentication
    shieldMapping.route("*").all(shieldAuth);
    // shield access controll
    if(app.hasOwnProperty("access")){
        shieldMapping.route("*").all(ShieldAccess(app.access));
    }
    if(app.hasOwnProperty("url")) {
        // shield proxy
        shieldMapping.route("*").all(ShieldProxy(app.url));
    }
    // link
    this.use(app.path, shieldMapping);
    // add associated app module
    if(app.hasOwnProperty("module")) {
        var moduleName = (app.development ? "./apps/" : "") + app.module;
        // we need to link it this way to get mount event
        var handler = require(moduleName);
        if(typeof handler.disable == "function") {
            handler.disable("x-powered-by");
        }
        this.use(app.path, handler);
    }
}

function bootstrap(logger, env) {

    var server = require("./lib/shield-start").create({
        rootDir: path.join(__dirname, "root"),
        tls: config.tls
    }, app);
    app.server = server;

    app.use(morgan(logger.format, logger.options));
    
    app.route("/").all(shieldAuth[0]);
    app.route("/").get(function(req, res){
        res.status(200).render("index", { title: "Mapping", apps: config.apps });
    });

    config.apps.forEach(createShield, app);

    /**
     * Not found handler
     */
    app.use(function(req, res){
        res.status(404).render("404", { title: "404" });
    });

    /**
     * Error handler
     */
    if (env == "development") {
        app.use(function errorHandler(err, req, res, next) { //eslint-disable-line
            var stack = (err.stack || "").split("\n").slice(1);
            var message = err.message || err;
            logger.error(err.stack || err);
            res.status(500).render("500", { title: "500", err: {
                message: message,
                stack: stack
            }});
        });
    } else {
        app.use(function errorHandler(err, req, res, next) { //eslint-disable-line
            logger.error(err.stack || err);
            res.status(500).render("500", { title: "500", err: {
                message: "Check server logs.",
            }});
        });
        app.disable("x-powered-by");
    }

    return server;
}

/**
 * run server
 */
function startServer() {

    var env = app.get("env");
    var logger = app.locals.logger = require("./lib/shield-logger");

    bootstrap(logger, env).on("error", function(err){
        logger.error(err);
    })
    .listen(config.port || 8080, config.hostname, function() {
        logger.log("[%s] listening on port %d (%s)", env, this.address().port, this.type);
    });
}

if(require.main === module){
    // generate password hash
    if(process.argv[2] == "hash"){
        AuthService.generateAuthHash({pass: process.argv[3]}, config.keys.password).catch(function(err){
            return `ERROR: ${err.message}`;
        }).then(console.log); //eslint-disable-line
        return;
    }
    startServer();
}else {
    module.exports = startServer;
}