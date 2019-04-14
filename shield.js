// dependencies
const express = require("express");
const path = require("path");

// express middleware
const cookieParser = require("cookie-parser");
// template engine
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

// custom modules are resolved in working dir
const workingDir = path.resolve(".");
const resolveModule = (id) => {
    const modulePath = require.resolve(id, { paths: [ workingDir ] });
    return require(modulePath);
};

const configureService = (source, providers = []) => {
    const [ module, config ] =  !Array.isArray(source) ? [source] : source;
    return [resolveModule(providers[module] || module), config];
};

const configDirectory = Symbol("configDirectory");
const config = loadConfig();

const ShieldProxy = require("./lib/shield-proxy");
const ShieldAccess = require("./lib/shield-access");

const serviceProviders = {
    authentication: {
        "BasicAuthentication": "./lib/auth/basic-auth",
        "CertificateAuthentication": "./lib/auth/cert-auth"
    }
};

const services = require("./lib/shield-services")(app, [
    [require("./lib/auth-service")],
    [require("./lib/auth/local-auth-service")],
    [require("./lib/auth/cert-auth-service")],
    [require("./lib/auth/cookie-auth-filter"), { cookieName: "token" }],
]
.concat(configurableServices({ "authentication": "BasicAuthentication" }))
);

function configurableServices(defaults) {
    const { plugins } = config;
    const services = Object.assign(defaults, plugins);
    
    const { authentication } = services;

    return [configureService(authentication, serviceProviders.authentication)];
}

const shieldAuth = [
    require("./lib/check-auth")(services["authentication-filter"].check, setHtmlBaseUrl),
    services["authentication"]
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
async function initLogging(logger) {
    const morgan = logger.init();
    //TODO: merge with services
    const { logging } = config.plugins;
    if (logging) {
        const [module, config] = configureService(logging);
        await module(morgan, core.executeSync, config);
    }
    return morgan(logger.format, { stream: logger.stream });
}

// html base
function setHtmlBaseUrl(req, res) {
    const auth = res.locals.auth;
    const baseUrlPrefix = auth ? auth.baseUrl : "";
    res.locals.baseUrl = `${baseUrlPrefix}${req.baseUrl}/`;
}

function loadConfig() {
    const filename = path.resolve("config", "config.json");
    const defaults = { 
        plugins: {}
    };
    return Object.assign(defaults, require(path.resolve(filename)), {
        [configDirectory]: path.dirname(filename)
    });
}

function createShield(app) {
    const shieldMapping = express.Router();
    // shield authentication
    shieldMapping.route("*").all(shieldAuth);
    // shield access control
    if (app.hasOwnProperty("access")) {
        shieldMapping.route("*").all(ShieldAccess(app.access));
    }
    if (app.hasOwnProperty("url")) {
        // shield proxy
        shieldMapping.route("*").all(ShieldProxy(app.url));
    }

    function getPaths(app) {
        return [ app.path, app.alias ]
        .filter((path) => path !== undefined)
        .map((path) => path.startsWith("/") ? path : `/${path}`);
    }

    const paths = getPaths(app);

    // link
    paths.forEach((path) => this.use(path, shieldMapping));

    // add associated app module
    if (app.hasOwnProperty("module")) {
        const moduleName = app.module;
        // we need to link it this way to get mount event
        const handler = resolveModule(moduleName);
        if (typeof handler.disable === "function") {
            handler.disable("x-powered-by");
        }
        // add custom module config
        if (typeof handler.locals === "object") {
            const api = this.locals.api;
            const moduleSTM = api.stm.region(moduleName);
            const moduleQueue = api.queue.region(`${moduleName}-queue`);
            handler.locals = Object.assign(handler.locals, {
                api: {
                    stm: moduleSTM,
                    queue: moduleQueue,
                    executeSync: core.executeSyncUtil.bind(null, moduleQueue, moduleSTM)
                },
                config: app.config
            });
        }
        // add logger
        handler.logger = this.logger;
        // link
        paths.forEach((path) => this.use(path, handler));
    }
}

async function bootstrap(logger, env) {
    const rootDir = config[configDirectory];
    const server = await require("./lib/shield-start").create({
        rootDir: rootDir,
        tls: config.tls
    }, app);

    app.server = server;
    app.rootDir = rootDir;
    
    app.use(await initLogging(logger));

    app.use((_, res, next) => {
        res.shieldError = (next, template, locals) => {
            next(new ShieldError(template, locals));
        };
        next();
    });

    const [ checkAuth ] = shieldAuth;

    app.route("/").all(checkAuth);
    app.route("/").get(function indexPage(req, res) {
        const auth = res.locals.auth;
        res.status(200).render("index", { 
            title: "Mapping", 
            apps: config.apps,
            show: (app) => {
                return app.access == undefined || auth && auth.hasRole(app.access);
            }
        });
    });
    // create shield mapping
    config.apps.forEach(createShield, app);
    /**
     * Not found handler
     */
    app.use(function notFoundHandler(req, res) {
        checkAuth(req, res, () => {
            res.status(404).render("404", { title: "404" });
        });
    });

    let sendError;
    /**
     * Error handler
     */
    if (env == "development") {
        sendError = (err, res, next) => {
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
        };
    } else {
        sendError = (err, res, next) => {
            logger.error(err.stack || err);
            if (res.headersSent) {
                return next(); // default handler
            }                
            res.status(500).render("500", { title: "500", err: {
                message: "Check server logs."
            }});
        };
        app.disable("x-powered-by");
    }

    app.use(async function errorHandler(err, req, res, next) {
        try {
            // this will set the right htmlBase
            // TODO: find a better way to handle it
            await checkAuth(req, res, () => {
                if (err.constructor === ShieldError) {
                    res.render(err.template, err.locals);
                    return;
                }
                sendError(err, res, next);
            });
        } catch (error) {
            sendError(error, res, next);
        }
    });

    const cookieKey = app.keys.cookie;
    // generate cookie key
    const key = await core.executeSync("cookie", () => {
        // for HMAC-SHA256 
        // this key should not exceeded 512bits ([64])
        // maximum length should incorporate 32bit space for random value ([4])
        // predefined cookie key from config has precedence
        return cookieKey || core.generateKey(48);
    });

    app.keys.cookie = key;
    return server;
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
async function startServer() {

    const env = app.get("env");
    const logger = app.logger = require("./lib/shield-logger");

    const passphrase = await keychain(logger);
    if (passphrase != null && config.tls) {
        config.tls["passphrase"] = passphrase;
    }
    const server = await bootstrap(logger, env);

    server.on("error", (error) => {
        logger.error(error);
    })
    .listen(config.port || 8080, config.hostname, function () {
        logger.log("[%s] listening on port %d (%s)", env, this.address().port, this.type);
    });

    if (config.sso) {
        const sso = Object.assign({ rootDir: app.rootDir }, config.sso, { certs: config.tls });
        const key = await require("./lib/auth/simple-sso")(sso, logger);
        app.sso = { key };
    }
}

if (require.main === module) {
    // generate password hash
    if (process.argv[2] == "hash") {
        return services["authentication"].generateAuthentication({
            name: process.argv[3],
            pass: process.argv[4]
        })
        .catch((error) => {
            return `ERROR: ${error.message}`;
        })
        .then(console.log); //eslint-disable-line
    }
    startServer().catch((error) => {
        console.error(error.stack); //eslint-disable-line
    });
} else {
    module.exports = startServer;
}