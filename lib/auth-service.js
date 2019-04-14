const jwt = require("jsonwebtoken");
const core = require("./util/core");
const AntiHammering = require("./util/anti-hammering");
const { SECONDS } = require("./util/time-unit");
const { SERVICE } = require("./util/service-registry");

module.exports = SERVICE("authService", [".app"], function AuthenticationFactory(app) {

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

    const getUser = require("./auth/local-users")(app);

    async function authenticate(provider, ip) {
        const logger = app.logger;
        const cookieKey = app.keys.cookie;         
        try {
            const { payload, user } = await provider({ getUser });            
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
            const user = await getUser(token.user, token.sso);
            return new Token(signedData, token, user.roles);
        } catch (error) {
            logger.error(error);
            throw new Error("Wrong Credentials");
        }
    }

    return {
        authenticate: (provider, ip) => {
            const hammeringCheck = (ip) => {
                return (result) => {
                    return antiHammering.check(ip, result);
                };
            };
            const hammering = hammeringCheck(ip);
            return authenticate(provider, ip).then(hammering, hammering);
        },

        verify: verify,
        
        clearHammering: (ip) => {
            return antiHammering.clear(ip);
        },

        get hammeringDelay() {
            return antiHammering.cooldownTime;
        }
    };
});