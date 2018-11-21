const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const core = require("./util/core");
const AntiHammering = require("./util/anti-hammering");
const { SECONDS } = require("./util/time-unit");

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

    const threshold = { count: 3, timestamp: SECONDS(30).ms };  // 3x in 30s
    const cooldownTime = SECONDS(10).ms;
    const antiHammering = new AntiHammering("clientMap", threshold, cooldownTime);

    const jwtSign = core.promisify(jwt.sign);
    const jwtVerify = core.promisify(jwt.verify);

    async function getUser(username) {
        const users = app.locals.users;
        const user = users[username];
        if (!user) {
            throw new Error(`Unknown user [${username}]`);
        }
        return user;
    }

    async function authenticate(credentials, ip) {
        const logger = app.logger;
        const cookieKey = app.keys.cookie;         
        try {
            const user = await getUser(credentials.name);
            const match = await verifyAuthHash(user.key, credentials);
            if (!match) {
                throw new Error(`Wrong password for user [${credentials.name}]`);
            }
            
            const payload = { user: credentials.name };
            const signedData = await jwtSign(payload, core.generateSecret(cookieKey, ip), { expiresIn: "90d", mutatePayload: true });
            return new Token(signedData, payload, user.roles);
        } catch (err) {
            logger.error(err);
            throw new Error("Wrong Credentials");
        }
    }

    async function verify(signedData, ip) {
        if (!signedData) {
            throw new Error("Missing signed data");
        }

        const logger = app.logger;

        const localVerify = () => {
            const key = core.generateSecret(app.keys.cookie, ip);
            return jwtVerify(signedData, key);
        };
        const ssoVerify = (sso) => {
            // sso with fallback to local
            return jwtVerify(signedData, sso.key).catch(localVerify);
        };
            
        const result = app.sso ? ssoVerify(app.sso) : localVerify();

        try {
            const token = await result;
            try {
                const user = await getUser(token.user);
                return new Token(signedData, token, user.roles);
            } catch(error) {
                if (token.sso) {
                    // SSO without local record
                    return new Token(signedData, token);
                }
                throw error;
            }
        } catch (error) {
            logger.error(error);
            throw new Error("Wrong Credentials");
        }
    }

    async function verifyAuthHash(encryptedHash, credentials) {
        if (!encryptedHash || credentials.pass == undefined) {
            return false;
        }
        const key = app.keys.password;
        const hash = await core.decrypt(encryptedHash, key, credentials.name);
        return argon2.verify(hash, credentials.pass);
    }

    return {
        authenticate: (credentials, ip) => {
            const hammeringCheck = (ip) => {
                return (result) => {
                    return antiHammering.check(ip, result);
                };
            };
            const hammering = hammeringCheck(ip);
            return authenticate(credentials, ip).then(hammering, hammering);
        },

        verify: verify,
        
        clearHammering: (ip) => {
            return antiHammering.clear(ip);
        },

        get hammeringDelay() {
            return antiHammering.cooldownTime;
        }
    };
};

module.exports.generateAuthHash = async (credentials, key) => {
    const hash = await argon2.hash(credentials.pass);
    return core.encrypt(hash, key, credentials.name);
};
