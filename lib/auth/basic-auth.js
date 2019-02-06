const { SERVICE } = require("../util/service-registry");
const { SECONDS } = require("../util/time-unit");

module.exports = SERVICE("authentication", ["authService", ".config"], function BasicAuthHandlerFactory(authService, { cookieName }) {

    /**
     * RegExp for basic auth credentials
     *
     * credentials = auth-scheme 1*SP token68
     * auth-scheme = "Basic" ; case insensitive
     * token68     = 1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="
     * @private
     */

    const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/;

    /**
     * RegExp for basic auth user/pass
     *
     * user-pass   = userId ":" password
     * userId      = *<TEXT excluding ":">
     * password    = *TEXT
     * @private
     */

    const USER_PASS_REGEXP = /^([^:]*):(.*)$/;

    class Credentials {
        constructor(name, pass) {
            this.name = name;
            this.pass = pass;
        }
    }

    /**
     * Uses browser basic user authentication scheme
     */
    return Object.assign(function BasicAuthHandler(req, res, next) {
        const credentials = basicAuth(req);
        
        if (!credentials) {
            return unauthorized(req, res, next);
        }

        authService.authenticate(credentials, req.ip).then((token) => {
            res.locals.auth = token;
            res.cookie(cookieName, token.signedData, {
                httpOnly: true,
                secure: true,
                expires: new Date(SECONDS(token.exp).ms)
            });
            next();
        }, () => {
            unauthorized(req, res, next);
        })
        .catch(next);
    }, {
        generateAuthentication: async (credentials) => authService.generateAuthHash(credentials)
    });

    function unauthorized(req, res, next) {
        if (!req.secure) {
            return next(new Error("Non encrypted connection."));
        }
        res.setHeader("WWW-Authenticate", 'Basic realm="Shield"'); //eslint-disable-line
        res.status(401).shieldError(next, "401", { title: "401" });
    }

    function basicAuth(req) {
        
        let match, credentials;

        const authorization = req.headers.authorization;
        if (!(match = (typeof authorization === "string") && CREDENTIALS_REGEXP.exec(authorization)) || 
            !(credentials = USER_PASS_REGEXP.exec(Buffer.from(match[1], "base64").toString()))) {
            return null;
        }
        
        return new Credentials(credentials[1], credentials[2]);
    }
});