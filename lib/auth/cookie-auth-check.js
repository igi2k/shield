const { SERVICE } = require("../util/service-registry");

module.exports = SERVICE("authentication-check", ["authService", ".config"], function CookieAuthCheckFactory(authService, { cookieName }) {
    
    return function authenticate(req, res) {
        const signedData = req.cookies[cookieName];
        return authService.verify(signedData, req.ip).catch((error) => {
            if(signedData){
                res.clearCookie(cookieName);
            }
            throw error;
        });
    };
    
});