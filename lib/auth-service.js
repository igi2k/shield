const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const core = require("./util/core");

const clientMap = require("./stm").region("clientMap");

module.exports = function AuthenticationFactory(app) {

    class Token {

        constructor(signedData, token, roles) {
            this.signedData = signedData;
            this.user = token.user;
            this.exp = token.exp;
            this.roles = roles || [];
            this.baseUrl = token.baseUrl || "";
            this.isExternal = !!token.sso;
        }

        hasRole(role) {
            return this.roles.indexOf(role) >= 0;
        }
    }

    const threshold = { count: 3, timestamp: 30 * 1000 };  // 3x in 30s
    const cooldownTime = 10 * 1000; // 10s

    function antiHammering(ip, result) {

        const fail = result instanceof Error;

        function processEntry(entry) {
            const timestamp = Date.now();
            let hammering = false;
            
            if (timestamp - entry.timestamp < threshold.timestamp) {
                if (fail) { // update when user supplied wrong credentials
                    entry.count += 1;
                }
                hammering = entry.count > threshold.count;
            } else {
                entry.count = 1;
            }
            
            entry.timestamp = timestamp;
            
            return clientMap.set(ip, entry)
            .then(() => {
                return hammering;
            }, processEntry); // stm retry
        }

        return new Promise((resolve, reject) => {

            function passResult() {
                if (fail) {
                    return reject(result);
                }
                resolve(result);
            }

            clientMap.get(ip, { count: 0, timestamp: Date.now() })
            .then(processEntry)
            .then((hammering) => {
                setTimeout(passResult, hammering ? cooldownTime : 0);
            })
            .catch(passResult); // case when there is something wrong
        });
    }

    function getUser(username) {
        return new Promise((resolve, reject) => {
            const users = app.locals.users;
            const user = users[username];
            if (!user) {
                return reject(new Error(`Unknown user [${username}]`));
            }
            resolve(user);
        });
    }

    function authenticate(credentials, ip) {
        const logger = app.logger;
        
        return getUser(credentials.name)
        .then((user) => {
            const cookieKey = app.keys.cookie;         
            const sign = core.promisify(jwt.sign);

            return verifyAuthHash(user.key, credentials)
            .then((match) => {
                if (!match) {
                    throw new Error(`Wrong password for user [${credentials.name}]`);
                }
                return sign({ user: credentials.name }, core.generateSecret(cookieKey, ip), { expiresIn: "90d" })
                .then((signedData) => {
                    return new Token(signedData, jwt.decode(signedData), user.roles);
                });
            });
        })
        .catch((err) => {
            logger.error(err);
            throw new Error("Wrong Credentials");
        });
    }

    function verify(signedData, ip) {
        if (!signedData) {
            return Promise.reject(new Error("Missing signed data"));
        }
        
        const verify = core.promisify(jwt.verify);
        const logger = app.logger;
        
        function localVerify() {
            const key = core.generateSecret(app.keys.cookie, ip);
            return verify(signedData, key);
        }

        function ssoVerify(sso) {
            // sso with fallback to local
            return verify(signedData, sso.key).catch(localVerify);
        }

        const result = app.sso ? ssoVerify(app.sso) : localVerify();
  
        return result.catch((error) => {
            logger.error(error);
            throw error;
        }).then((token) => {
            return getUser(token.user)
            .then((user) => {
                return new Token(signedData, token, user.roles);
            })
            .catch((err) => {
                if (token.sso) {
                    // SSO without local record
                    return new Token(signedData, token);
                }
                logger.error(err);
                throw new Error("Wrong Credentials");
            });
        });
    }

    function verifyAuthHash(hash, credentials) {
        if (!hash) {
            return Promise.resolve(false);
        }
        const key = app.keys.password;
        return core.decrypt(hash, key, credentials.name).then((hash) => {
            return argon2.verify(hash, credentials.pass);
        });
    }

    function hammeringCheck(ip) {
        return (result) => {
            return antiHammering(ip, result);
        };
    }

    function clearHammering(ip) {
        const processEntry = (entry) => {
            entry.count = 0;
            return clientMap.set(ip, entry)
            .catch(processEntry);
        };
        return clientMap.get(ip, { count: 0, timestamp: Date.now() })
        .then(processEntry);
    }

    return {
        authenticate: function (credentials, ip) {
            const hammering = hammeringCheck(ip);
            return authenticate(credentials, ip).then(hammering, hammering);
        },
        verify: verify,
        clearHammering: clearHammering
    };
};

module.exports.generateAuthHash = function (credentials, key) {
    return argon2.hash(credentials.pass).then((hash) => {
        return core.encrypt(hash, key, credentials.name);
    });
};
