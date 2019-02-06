module.exports = function CheckAuthHandlerFactory(authenticationCheck, setHtmlBaseUrl) {
        
    /**
     * Validates authentication
     */
    return async function CheckAuthHandler(req, res, next) {

        const validToken = (token) => {
            res.locals.auth = token;
            return "route";
        };

        return authenticationCheck(req, res)
        .then(validToken, () => undefined)
        .then((route) => {
            setHtmlBaseUrl(req, res);
            next(route);
        });
    };    
};
