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
            setHtmlBaseUrl(req, res);
        }
        function validToken(token) {
            res.locals.auth = token;
            return "route";
        }
        authService.verify(signedData, req.ip)
        .then(validToken, invalidToken)
        .then((route) => {
            setHtmlBaseUrl(req, res);
            next(route);
        });
    };    
};
