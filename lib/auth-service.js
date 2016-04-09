var jwt = require('jsonwebtoken');
var crypto = require('crypto');

module.exports = function AuthenticationFactory(app) {
    
    function authenticate(credentials) {
        var users = app.locals.users;
        if(!users.hasOwnProperty(credentials.user)){
            return;
        }
        var secretKey = app.locals.secretKey;
        var hmac = crypto.createHmac('sha256', secretKey);
        hmac.update(credentials.password);
        var password = hmac.digest('hex');
        if(users[credentials.user] === password){
            return jwt.sign({ user: credentials.user }, secretKey); 
        }
    }    

    function verify(token) {
        try {
            return jwt.verify(token, app.locals.secretKey);
        } catch(err) {
            app.locals.log(err);
        }
    }
    
    return {
        authenticate: authenticate,
        verify: verify
    };
};

