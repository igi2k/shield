module.exports = function CheckAuthHandlerFactory(authService) {
    /**
     * Validates user token
     */
    return function CheckAuthHandler(req, res, next) {
        var token = req.cookies.token;
        if(token){
            var auth = authService.verify(token, req.ip);
            if(auth){
                res.locals.auth = auth;
                next('route');
                return;
            } else {
                res.clearCookie("token");
            }
        }
        next();
    };    
};


