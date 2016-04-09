// dependencies
var express = require('express');
var app = express();

// express middleware
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
// templating engine
var htmlEngine = require('gaikan');

var port = process.env.PORT || 8080;
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

app.route("/favicon.ico").get(function(req, res){
    res.sendfile(__dirname + "/root/favicon.ico");
});

var config = require("./shield-config");
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
config.app.forEach(createShield, app);
// setup access
app.locals.secretKey = config.secretKey;
app.locals.users = config.users;

/**
 * Not found handler
 */
app.use(function(req, res){
    res.status(404).render('404', { title: 404 });
});

/**
 * Error handler
 */
if (env == 'development') {
    app.use(function errorHandler(err, req, res, next){
        var stack = (err.stack || '').split('\n').slice(1);
        var message = err.message;
        app.locals.log(err.stack);
        res.status(500).render('500', { title: 500, err: {
            message: message,
            stack: stack
        }});
    });
}

/**
 * run server
 */
function startServer(id){

    logOptions._source = function(tokens, req, res){
        return id + ": " +  morgan['dev'](tokens, req, res);
    };
    
    app.locals.log = function(message, req){
        if(req){
            console.error("%s: [%s] %s", id, req.ip, message);
        } else {
            console.error("%s: %s", id, message);
        }
    }; 

    app.listen(port, "localhost", function() {
        console.log('%s: [%s] listening on port %d', id, env, this.address().port);
    });
}
if(require.main === module){
    startServer("main");
}else {
    module.exports = startServer;
}