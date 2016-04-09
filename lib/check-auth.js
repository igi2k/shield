module.exports = function CheckAuthHandlerFactory(authService) {
    /**
     * Validates user token
     */
    return function CheckAuthHandler(req, res, next) {
        var token = req.cookies.token;
        if(token){
            var data = authService.verify(token);
            if(data){
                res.locals.user = data;
                next('route');
                return;
            } else {
                res.clearCookie("token");
            }
        }
        next();
    };    
};


