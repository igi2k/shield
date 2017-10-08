// dependencies
const express = require("express");
const path = require("path");

// express middleware
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
// templating engine
const htmlEngine = require("gaikan");
// core utils
const core = require("./lib/util/core");

const app = express();

/**
 * express configuration
 */
app.use(cookieParser());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", ".html");
app.engine("html", htmlEngine);

app.use("/static", express.static(path.join(__dirname, "static")));

class ShieldError {
    constructor(template, locals) {
        this.template = template;
        this.locals = locals;
    }
}

const config = loadConfig();

const ShieldProxy = require("./lib/shield-proxy");
const ShieldAccess = require("./lib/shield-access");
const AuthService = require("./lib/auth-service");
const authService = AuthService(app);
const shieldAuth = [
    require("./lib/check-auth")(authService, setHtmlBaseUrl),
    require("./lib/auth/basic-auth")(authService, ShieldError)
];

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
morgan.token("remote-addr-lookup", function (req) {
    const ip = this["remote-addr"](req);
    return ipLookup[ip] || ip;
});
// html base
function setHtmlBaseUrl(req, res) {
    const auth = res.locals.auth;
    const baseUrlPrefix = auth ? auth.baseUrl : "";
    res.locals.baseUrl = `${baseUrlPrefix}${req.baseUrl}/`;
}

function loadConfig() {
    const fileName = path.join(__dirname, "root", "config.json");
    return require(fileName);
}

function createShield(app) {
    const shieldMapping = express.Router();
    // shield authentication
    shieldMapping.route("*").all(shieldAuth);
    // shield access controll
    if (app.hasOwnProperty("access")) {
        shieldMapping.route("*").all(ShieldAccess(app.access, ShieldError));
    }
    if (app.hasOwnProperty("url")) {
        // shield proxy
        shieldMapping.route("*").all(ShieldProxy(app.url));
    }

    function getPaths(app) {
        return [app.path, app.alias]
        .filter((path) => path !== undefined)
        .map((path) => {
            return path.startsWith("/") ? path : `/${path}`;
        });
    }

    const paths = getPaths(app);

    // link
    paths.forEach((path) => {
        this.use(path, shieldMapping);
    });

    // add associated app module
    if (app.hasOwnProperty("module")) {
        const moduleName = (app.development ? "./apps/" : "") + app.module;
        // we need to link it this way to get mount event
        const handler = require(moduleName);
        if (typeof handler.disable === "function") {
            handler.disable("x-powered-by");
        }
        // add custom module config
        if(typeof handler.locals === "object") {
            handler.locals = Object.assign(handler.locals, {
                api: this.locals.api,
                config: app.config
            });
        }
        // add logger
        handler.logger = this.logger;
        // link
        paths.forEach((path) => {
            this.use(path, handler);
        });
    }
}

function bootstrap(logger, env) {
    const rootDir = path.join(__dirname, "root");
    return require("./lib/shield-start").create({
        rootDir: rootDir,
        tls: config.tls
    }, app).then((server) => {
        app.server = server;
        app.rootDir = rootDir;
        app.use(morgan(logger.format, logger.options));

        const checkAuth = shieldAuth[0];
        app.route("/").all(checkAuth);
        app.route("/").get(function (req, res) {
            const auth = res.locals.auth;
            res.status(200).render("index", { 
                title: "Mapping", 
                apps: config.apps,
                show: (app) => {
                    return app.access == undefined || auth && auth.hasRole(app.access);
                }
            });
        });

        config.apps.forEach(createShield, app);

        /**
         * Not found handler
         */
        app.use(function (req, res) {
            checkAuth(req, res, () => {
                res.status(404).render("404", { title: "404" });
            });
        });

        function handleShieldError(err, res) {
            if (err.constructor === ShieldError) {
                res.render(err.template, err.locals);
                return true;
            }
            return false;
        }

        /**
         * Error handler
         */
        if (env == "development") {
            app.use(function errorHandler(err, req, res, next) {
                function sendError(err) {
                    logger.error(err.stack || err);
                    if (res.headersSent) {
                        return next(); // default handler
                    }
                    const stack = (err.stack || "").split("\n").slice(1);
                    const message = err.message || err;
                    res.status(500).render("500", { title: "500", err: {
                        message: message,
                        stack: stack
                    }});
                }
                checkAuth(req, res, () => {
                    if (handleShieldError(err, res)) {
                        return;
                    }
                    sendError(err);
                }).catch(sendError);
            });
        } else {
            app.use(function errorHandler(err, req, res, next) {
                function sendError(err) {
                    logger.error(err.stack || err);
                    if (res.headersSent) {
                        return next(); // default handler
                    }                
                    res.status(500).render("500", { title: "500", err: {
                        message: "Check server logs.",
                    }});
                }
                checkAuth(req, res, () => {
                    if (handleShieldError(err, res)) {
                        return;
                    }
                    sendError(err);
                }).catch(sendError);
            });
            app.disable("x-powered-by");
        }
        const cookieKey = app.keys.cookie;
        // generate cookie key
        return core.executeSync("cookie", () => {
            // for HMAC-SHA256 
            // this key should not exceeded 512bits ([64])
            // maximum lenght should incorporate 32bit space for random value ([4])
            // predefined cookie key from config has precedence
            return cookieKey || core.generateKey(48);
        })
        .then((key) => {
            app.keys.cookie = key;
            return server;
        });
    });
}

function keychain(logger) {
    return core.executeSync("keychain", () => {
        return require("keytar").getPassword("shield", "tls-passphrase")
        .catch((error) => {
            logger.error(`keychain: ${error.message}`);
        });
    });
}

/**
 * run server
 */
function startServer() {

    const env = app.get("env");
    const logger = app.logger = require("./lib/shield-logger");

    return keychain(logger).then((passphrase) => {
        if (passphrase != null && config.tls) {
            config.tls["passphrase"] = passphrase;
        }
        return bootstrap(logger, env).then((server) => {
            server.on("error", (error) => {
                logger.error(error);
            })
            .listen(config.port || 8080, config.hostname, function () {
                logger.log("[%s] listening on port %d (%s)", env, this.address().port, this.type);
            });
        })
        .then(() => {
            if (config.sso) {
                const sso = Object.assign({ rootDir: app.rootDir }, config.sso, { certs: config.tls });
                return require("./lib/auth/simple-sso")(sso, logger).then((key) => {
                    app.sso = { key };
                });
            }
        });
    })
    .catch((error) => {
        logger.error(error);
    });
}

if (require.main === module) {
    // generate password hash
    if (process.argv[2] == "hash") {
        return AuthService.generateAuthHash({
            name: process.argv[3],
            pass: process.argv[4]
        }, config.keys.password)
        .catch((error) => {
            return `ERROR: ${error.message}`;
        })
        .then(console.log); //eslint-disable-line
    }
    startServer();
} else {
    module.exports = startServer;
}