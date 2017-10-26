const basicAuth = require("basic-auth");

module.exports = function BasicAuthHandlerFactory(authService, ShieldError) {

    /**
     * Uses browser basic user authentication scheme
     */
    return function BasicAuthHandler(req, res, next) {
        const credentials = basicAuth(req);
        
        if (!credentials) {
            return unauthorized(req, res, next);
        }

        authService.authenticate(credentials, req.ip).then((token) => {
            res.locals.auth = token;
            res.cookie("token", token.signedData, {
                httpOnly: true,
                secure: true,
                expires: new Date(token.exp * 1000)
            });
            next();
        }, () => {
            unauthorized(req, res, next);
        })
        .catch(next);
    };

    function unauthorized(req, res, next) {
        if (!req.secure) {
            return next(new Error("Non encrypted connection."));
        }
        res.setHeader("WWW-Authenticate", 'Basic realm="Shield"'); //eslint-disable-line
        res.status(401);
        next(new ShieldError("401", { title: "401" }));
    }
};