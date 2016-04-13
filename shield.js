// dependencies
var express = require('express');
var path = require('path');

// express middleware
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
// templating engine
var htmlEngine = require('gaikan');

var app = express();

/**
 * express configuration
 */
app.use(cookieParser());

htmlEngine.options.layout = 'layout/main';
app.set('views', __dirname + '/views');
app.set('view engine', '.html');
app.engine('html', htmlEngine);

app.use("/static", express.static(__dirname + '/static'));

var config = loadConfig();

var ShieldProxy = require("./lib/shield-proxy");
var AuthService = require("./lib/auth-service");
var authService = AuthService(app);
var shieldAuth = [require("./lib/check-auth")(authService), require("./lib/auth/basic-auth")(authService)];

// setup access
app.locals.secretKey = config.secretKey;
app.locals.users = config.users;


function loadConfig(){
    var fileName = path.resolve(__dirname, "root", "config.json");
    return require(fileName);
}

function createShield(app){
    var shieldMapping = express.Router();
    // shield authentication
    shieldMapping.route("*").all(shieldAuth);
    // shield proxy
    shieldMapping.route("*").all(ShieldProxy(app.url));
    // link
    this.use(app.path, shieldMapping);
}

function bootstrap(logger, env) {
    
    if (env == 'development') {
        app.use(morgan(logger.format, logger.options));
    }
    app.route("/").all(shieldAuth[0]);
    app.route("/").get(function(req, res){
        res.status(200).render('index', { title: "Mapping", apps: config.apps });
    });
    
    config.apps.forEach(createShield, app);

    /**
     * Not found handler
     */
    app.use(function(req, res){
        res.status(404).render('404', { title: "404" });
    });

    /**
     * Error handler
     */
    if (env == 'development') {
        app.use(function errorHandler(err, req, res, next){
            var stack = (err.stack || '').split('\n').slice(1);
            var message = err.message;
            app.locals.logger.error(err.stack);
            res.status(500).render('500', { title: "500", err: {
                message: message,
                stack: stack
            }});
        });
    }
}

/**
 * run server
 */
function startServer(id) {

    var shield = require("./lib/shield-start");
    var env = app.get('env');

    var logger = app.locals.logger = require("./lib/shield-logger");

    bootstrap(logger, env);
    
    shield.create({
        hostname: config.hostname,
        port: process.env.PORT || 8080,
        rootDir: __dirname + "/root",
        tls: config.tls
    }, app, function() {
        app.locals.logger.log('[%s] listening on port %d (%s)', env, this.address().port, this.type);
    }).on("error", function(err){
        app.locals.logger.error(err);
    });
}

if(require.main === module){
    // generate password hash
    if(process.argv[2] == 'hash'){
        console.log(AuthService.generateKey({pass: process.argv[3]}, app.locals.secretKey));
        return;
    }
    startServer();
}else {
    module.exports = startServer;
}