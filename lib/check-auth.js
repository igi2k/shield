module.exports = function CheckAuthHandlerFactory(authService, setHtmlBaseUrl) {
    /**
     * Validates user token
     */
    return function CheckAuthHandler(req, res, next) {
        var signedData = req.cookies.token;
        function invalidToken() {
            if(signedData){
                res.clearCookie("token");
            }
            next();
        }
        function validToken(token) {
            res.locals.auth = token;
            next("route");
        }
        setHtmlBaseUrl(req, res);
        authService.verify(signedData, req.ip).then(validToken, invalidToken);
    };    
};
