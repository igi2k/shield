var basicAuth = require("basic-auth");

module.exports = function BasicAuthHandlerFactory(authService) {

    /**
     * Uses browser basic user authentication scheme
     */
    return function BasicAuthHandler(req, res, next) {
        var credentials = basicAuth(req);
        if (!credentials) {
            unauthorized(req, res);
        } else {
            authService.authenticate(credentials, req.ip).then(function(token) {
                res.locals.auth = token;
                res.cookie("token", token.signedData, {
                    httpOnly: false,
                    secure: true,
                    expires: new Date(token.exp * 1000)
                });
                next();
            }, function () {
                unauthorized(req, res);
            });
        }
    };
};

function unauthorized(req, res){
    if(!req.secure){
        throw new Error("Non encrypted connection.");
    }
    res.setHeader("WWW-Authenticate", 'Basic realm="Shield"'); //eslint-disable-line
    res.status(401).render("401", { title: "401" });
}