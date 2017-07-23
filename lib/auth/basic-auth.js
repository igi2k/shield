const basicAuth = require("basic-auth");

module.exports = function BasicAuthHandlerFactory(authService, setHtmlBaseUrl) {

    /**
     * Uses browser basic user authentication scheme
     */
    return function BasicAuthHandler(req, res, next) {
        const credentials = basicAuth(req);
        if (!credentials) {
            unauthorized(req, res, setHtmlBaseUrl);
        } else {
            authService.authenticate(credentials, req.ip).then((token) => {
                res.locals.auth = token;
                res.cookie("token", token.signedData, {
                    httpOnly: true,
                    secure: true,
                    expires: new Date(token.exp * 1000)
                });
                next();
            }, function () {
                unauthorized(req, res, setHtmlBaseUrl);
            });
        }
    };
};

function unauthorized(req, res, setHtmlBaseUrl) {
    if (!req.secure) {
        throw new Error("Non encrypted connection.");
    }
    req.baseUrl = ""; //TODO: this should fall to generic handler
    setHtmlBaseUrl(req, res);
    res.setHeader("WWW-Authenticate", 'Basic realm="Shield"'); //eslint-disable-line
    res.status(401).render("401", { title: "401" });
}