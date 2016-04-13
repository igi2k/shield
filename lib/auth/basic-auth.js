var basicAuth = require('basic-auth');

module.exports = function BasicAuthHandlerFactory(authService) {
    /**
     * Uses browser basic user authentication scheme
     */
    return function BasicAuthHandler(req, res, next) {
        var credentials = basicAuth(req);
        if (!credentials) {
            unauthorized(req, res);
        } else {
            var token = authService.authenticate(credentials, req.ip);
            if(token){
                var auth = res.locals.auth = authService.verify(token, req.ip);
                res.cookie("token", token, { 
                    httpOnly: false,
                    secure: true,
                    expires: new Date(auth.exp * 1000)
                });
                next();
            } else {
                unauthorized(req, res);
            }
        }
    };
};

function unauthorized(req, res){
    if(!req.secure){
        throw new Error("Non encrypted connection.");
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Shield"');
    res.status(401).render('401', { title: "401" });
}