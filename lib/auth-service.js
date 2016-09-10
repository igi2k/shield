const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const clientMap = require("./stm").region("clientMap");

module.exports = function AuthenticationFactory(app) {

    function Token(signedData, token, roles) {
        this.signedData = signedData;
        this.user = token.user;
        this.exp = token.exp;
        this.roles = roles || [];
    }
    Token.prototype.hasRole = function (role) {
        return this.roles.indexOf(role) >= 0;
    };

    var threshold = { count: 3, timestamp: 30 * 1000 };  // 3x in 30s
    var cooldownTime = 10 * 1000; // 10s

    function antiHammering(ip, result) {

        var fail = result instanceof Error;

        function processEntry(entry) {
            var hammering = false;
            var timestamp = new Date().getTime();
            if (timestamp - entry.timestamp < threshold.timestamp) {
                if (fail) { // update when user supplied wrong credentials
                    entry.count++;
                }
                hammering = entry.count > threshold.count;
            } else {
                entry.count = 1;
            }
            entry.timestamp = timestamp;
            return clientMap.set(ip, entry).then(function () {
                return hammering;
            }, function (entry) { // stm retry
                return processEntry(entry);
            });
        }

        return new Promise(function (resolve, reject) {

            function passResult() {
                if (fail) {
                    reject(result);
                } else {
                    resolve(result);
                }
            }

            clientMap.get(ip, { count: 0, timestamp: new Date().getTime() }).then(processEntry).then(function (hammering) {
                setTimeout(passResult, hammering ? cooldownTime : 0);
            }).catch(passResult); // case when there is something wrong
        });
    }

    function getUser(username) {
        return new Promise(function (resolve, reject) {
            var users = app.locals.users;
            var user = users[username];
            if (!user) {
                return reject(new Error(`Unknown user [${username}]`));
            }
            resolve(user);
        });
    }

    function authenticate(credentials, ip) {
        return getUser(credentials.name).then(function (user) {
            var secretKey = app.locals.secretKey;
            return verifyAuthHash(user.key, credentials).then(function (match) {
                if (!match) {
                    return Promise.reject(new Error(`Wrong password for user [${credentials.name}]`));
                }
                return new Promise(function (resolve, reject) {
                    jwt.sign({ user: credentials.name }, secretKey + ip, { expiresIn: "90d" }, function (err, signedData) {
                        if (err) {
                            return reject(err);
                        }
                        resolve(new Token(signedData, jwt.decode(signedData), user.roles));
                    });
                });
            });
        }).catch(function (err) {
            app.locals.logger.error(err);
            return Promise.reject(new Error("Wrong Credentials"));
        });
    }

    function verify(signedData, ip) {
        if (!signedData) {
            return Promise.reject(new Error("Missing signed data"));
        }
        var secretKey = app.locals.secretKey;
        return new Promise(function (resolve, reject) {
            jwt.verify(signedData, secretKey + ip, function (err, token) {
                if (err) {
                    app.locals.logger.error(err);
                    return reject(err);
                }
                resolve(getUser(token.user).then(function (user) {
                    return new Token(signedData, token, user.roles);
                }).catch(function (err) {
                    app.locals.logger.error(err);
                    return Promise.reject(new Error("Wrong Credentials"));
                }));
            });
        });
    }

    function verifyAuthHash(hash, credentials) {
        return argon2.verify(hash, credentials.pass);
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

module.exports.generateKey = function (credentials) {
    return argon2.generateSalt().then(function (salt) {
        return argon2.hash(credentials.pass, salt);
    });
};
