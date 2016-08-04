const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const clientMap = require("./stm").region("clientMap");

module.exports = function AuthenticationFactory(app) {

    function Token(signedData, ip) {
        var secretKey = app.locals.secretKey;
        try {
            var values = jwt.verify(signedData, secretKey + ip);
            for (var key in values) {
                this[key] = values[key]
            }
            this.signedData = signedData
        } catch(err) {
            app.locals.logger.error(err);
        }

        Object.defineProperty(this, 'isValid', {
            get: function () {
                return !!this.signedData
            }
        })
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
                return hammering
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
                setTimeout(passResult, hammering ? cooldownTime : 0)
            }).catch(passResult); // case when there is something wrong
        })
    }

    function authenticate(credentials, ip) {
        var users = app.locals.users;
        if(!users.hasOwnProperty(credentials.name)){
            return Promise.reject(new Error("Missing Credentials"));
        }
        var secretKey = app.locals.secretKey;
        var password = AuthenticationFactory.generateKey(credentials, secretKey);
        if(users[credentials.name] === password) {
            var signedData = jwt.sign({ user: credentials.name }, secretKey + ip, { expiresIn: "90d" });
            return Promise.resolve(verify(signedData, ip));
        }
        return Promise.reject(new Error("Wrong Credentials"));
    }    

    function verify(signedData, ip) {
        return signedData && new Token(signedData, ip);
    }

    function hammeringCheck(ip) {
        return function (result) {
            return antiHammering(ip, result);
        }
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

