var jwt = require('jsonwebtoken');
var crypto = require('crypto');

module.exports = function AuthenticationFactory(app) {
    
    function authenticate(credentials, ip) {
        var users = app.locals.users;
        if(!users.hasOwnProperty(credentials.name)){
            return;
        }
        var secretKey = app.locals.secretKey;
        var password = AuthenticationFactory.generateKey(credentials, secretKey);
        if(users[credentials.name] === password){
            return jwt.sign({ user: credentials.name }, secretKey + ip, { expiresIn: "90d" });
        }
    }    

    function verify(token, ip) {
        var secretKey = app.locals.secretKey;
        try {
            return jwt.verify(token, secretKey + ip);
        } catch(err) {
            app.locals.logger.error(err);
        }
    }
    
    return {
        authenticate: authenticate,
        verify: verify
    };
};

module.exports.generateKey = function(credentials, secretKey){
    var hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(credentials.pass);
    return hmac.digest('hex');
};

