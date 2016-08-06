const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const clientMap = require("./stm").region("clientMap");

module.exports = function AuthenticationFactory(app) {

    function Token(signedData, token) {
        this.signedData = signedData;
        this.user = token.user;
        this.exp = token.exp;
    }

    var threshold = { count: 3, timestamp: 30 * 1000 };  // 3x in 30s
    var cooldownTime = 10 * 1000; // 10s

    function antiHammering(ip, result) {

        var fail = result instanceof Error;

        function processEntry(entry){
            var hammering = false;
            var timestamp = new Date().getTime();
            if (timestamp - entry.timestamp < threshold.timestamp) {
                if(fail) { // update when user supplied wrong credentials
                    entry.count++;
                }
                hammering = entry.count > threshold.count;
            } else {
                entry.count = 1;
            }
            entry.timestamp = timestamp;
            return clientMap.set(ip, entry).then(function() {
                return hammering;
            }, function(entry) { // stm retry
                return processEntry(entry);
            });
        }

        return new Promise(function(resolve, reject) {

            function passResult() {
                if(fail){
                    reject(result);
                } else {
                    resolve(result);
                }
            }

            clientMap.get(ip, { count: 0, timestamp: new Date().getTime()}).then(processEntry).then(function(hammering) {
                setTimeout(passResult, hammering ? cooldownTime : 0);
            }).catch(passResult); // case when there is something wrong
        });
    }

    function authenticate(credentials, ip) {
        var users = app.locals.users;
        if(users.hasOwnProperty(credentials.name)) {
            var secretKey = app.locals.secretKey;
            var password = AuthenticationFactory.generateKey(credentials, secretKey);
            if(users[credentials.name] === password) {
                return new Promise(function(resolve, reject) {
                    jwt.sign({ user: credentials.name }, secretKey + ip, { expiresIn: "90d" }, function(err, signedData) {
                        if(err){
                            return reject(err);
                        }
                        resolve(new Token(signedData, jwt.decode(signedData)));
                    });
                });
            }
        }
        return Promise.reject(new Error("Wrong Credentials"));
    }    

    function verify(signedData, ip) {
        if(!signedData){
            return Promise.reject(new Error("Missing signed data"));
        }
        var secretKey = app.locals.secretKey;
        return new Promise(function(resolve, reject){
            jwt.verify(signedData, secretKey + ip, function(err, token) {
                if(err){
                    app.locals.logger.error(err);
                    return reject(err);
                }
                resolve(new Token(signedData, token));
            });
        });        
    }

    function hammeringCheck(ip) {
        return function (result) {
            return antiHammering(ip, result);
        };
    }

    return {
        authenticate: function (credentials, ip) {
            var hammering = hammeringCheck(ip);
            return authenticate(credentials, ip).then(hammering, hammering);
        },
        verify: verify
    };
};

module.exports.generateKey = function(credentials, secretKey){
    var hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(credentials.pass);
    return hmac.digest('hex');
};

