// dependencies
var express = require('express');

// express middleware
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
// templating engine
var htmlEngine = require('gaikan');

var app = express();
var env = app.get('env');

/**
 * express configuration
 */
app.use(cookieParser());
app.use(bodyParser());

var logOptions = {
    format: function(tokens, req, res){
        return logOptions._source(tokens, req, res);
    }
};

if (env == 'development') {
    app.use(morgan(logOptions));
}
htmlEngine.options.layout = 'layout/main';
app.set('views', __dirname + '/views');
app.set('view engine', '.html');
app.engine('html', htmlEngine);

app.use("/static", express.static(__dirname + '/static'));

var config = require("./shield-config");

app.route("/").get(function(req, res){
    res.status(200).render('index', { title: "Mapping", apps: config.apps });
});

var ShieldProxy = require("./lib/shield-proxy");
var authService = require("./lib/auth-service")(app);
var shieldAuth = [require("./lib/check-auth")(authService), require("./lib/basic-auth")(authService)];
function createShield(app){
    var shieldMapping = express.Router();
    // shield authentication
    shieldMapping.route("*").all(shieldAuth);
    // shield proxy
    shieldMapping.route("*").all(ShieldProxy(app.url));
    // link
    this.use(app.path, shieldMapping);
}
config.apps.forEach(createShield, app);
// setup access
app.locals.secretKey = config.secretKey;
app.locals.users = config.users;

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
        app.locals.log(err.stack);
        res.status(500).render('500', { title: "500", err: {
            message: message,
            stack: stack
        }});
    });
}

/**
 * run server
 */
function startServer(id) {

    var shield = require("./lib/shield-start");
    
    logOptions._source = function(tokens, req, res){
        return id + ": " +  morgan['dev'](tokens, req, res);
    };
    
    app.locals.log = function(message){
        console.error("%s: %s", id, message);
    }; 

    shield.create({
        hostname: "localhost",
        port: process.env.PORT || 8080,
        rootDir: __dirname + "/root",
        tls: {
            key: "shield-key.pem",
            cert: "shield-cert.pem",
            ca: "ca-cert.pem"
        }
    }, app, function() {
        console.log('%s: [%s] listening on port %d (%s)', id, env, this.address().port, this.type);
    });
}
if(require.main === module){
    startServer("main");
}else {
    module.exports = startServer;
}