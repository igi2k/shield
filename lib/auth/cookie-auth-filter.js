const { SERVICE } = require("../util/service-registry");
const { SECONDS } = require("../util/time-unit");

module.exports = SERVICE("authentication-filter", ["authService", ".config"], function CookieAuthFilterFactory(authService, { cookieName }) {
   
    function update(res, token) {
        res.locals.auth = token;
        res.cookie(cookieName, token.signedData, {
            httpOnly: true,
            secure: true,
            expires: new Date(SECONDS(token.exp).ms)
        });
    }

    function verify(req, res) {
        const signedData = req.cookies[cookieName];
        return authService.verify(signedData, req.ip).catch((error) => {
            if (signedData){
                res.clearCookie(cookieName);
            }
            throw error;
        });
    }
    
    return {
        check: verify,
        update: update
    };
});