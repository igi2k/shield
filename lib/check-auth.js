module.exports = function CheckAuthHandlerFactory(authService, setHtmlBaseUrl) {
    /**
     * Validates user token
     */
    return function CheckAuthHandler(req, res, next) {
        const signedData = req.cookies.token;
        function invalidToken() {
            if(signedData){
                res.clearCookie("token");
            }
        }
        function validToken(token) {
            res.locals.auth = token;
            return "route";
        }
        return authService.verify(signedData, req.ip)
        .then(validToken, invalidToken)
        .then((route) => {
            setHtmlBaseUrl(req, res);
            next(route);
        });
    };    
};
