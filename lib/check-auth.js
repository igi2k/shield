module.exports = function CheckAuthHandlerFactory(authService) {
    /**
     * Validates user token
     */
    return function CheckAuthHandler(req, res, next) {
        var token = authService.verify(req.cookies.token, req.ip);
        if(token){
            if(token.isValid){
                res.locals.auth = token;
                next('route');
                return;
            } else {
                res.clearCookie("token");
            }
        }
        next();
    };    
};


