const assert = require("assert");

describe("Authentication Service", function () {
    
    const appStub = {
        keys: {
            password: "secret-password",
            cookie: "secret-cookie"
        },
        locals: {
            users: {
                "test": {
                    "key": "WgnRQlohr6EOVWFy/8+sFJuaLmoiO9rqHz8QKTWbPGj9Z0oNzH1GGR89JmxFuedspJ8cfHffRPUK+6QuRelrqLsvWkKYws4rhscmurzko0o2mHycmjJCtKLA8p9ei94o"
                }
            }
        },
        logger: {
            error: () => {}
        }
    };
    const ipAddress = "192.168.5.20";
    const credentials = {
        name: "test",
        pass: "test"
    };

    const responseStub = {
        setHeader: () => {},
        status: () => {},
        cookie: () => {},
        locals: {}
    };

    const AuthService = require("../lib/auth-service");
    const authService = AuthService(appStub);

    describe("authenticate", function () {
        const hammeringDelay = 10 * 1000; // 10s

        it("should authenticate", function() {
            return authService.authenticate(credentials, ipAddress)
            .then((token) => {
                assert.equal(credentials.name, token.user);
            });
        });

        it("should protect from hammering", function() {
            const wrongCredentials = {
                name: credentials.name
            };
            const withCredentials = (credentials) => {
                return (error) => {
                    if(error) {
                        assert.equal("Wrong Credentials", error.message);
                    }
                    return authService.authenticate(credentials, ipAddress);
                };    
            };
            const time = Date.now();
            return withCredentials(wrongCredentials)()
            .catch(withCredentials(wrongCredentials))
            .catch(withCredentials(wrongCredentials))
            .catch(withCredentials(wrongCredentials))
            .catch(withCredentials(credentials))
            .then((token) => {
                const diff = Date.now() - time;
                assert.equal(credentials.name, token.user);
                assert.equal(true, diff > hammeringDelay * 2);
            });
        })
        .timeout(hammeringDelay * 2 + 500);

        after(function() {
            return authService.clearHammering(ipAddress);
        });
    });

    describe("verify", function () {
        let tokenResult;
        before(function() {
            return authService.authenticate(credentials, ipAddress)
            .then((token) => {
                tokenResult = token;
            });
        });

        it("should verify authentication", function() {
            return authService.verify(tokenResult.signedData, ipAddress)
            .then((token) => {
                assert.equal(tokenResult.user, token.user);
            });
        });
    });

    describe("generateAuthHash", function () {
        it("should generate password hash", function() {
            return AuthService.generateAuthHash(credentials, appStub.keys.password)
            .then((result) => {
                assert.equal(true, result.startsWith(appStub.locals.users[credentials.name].key.substr(0, 20)));
            });
        });
    });

    describe("Basic authentication", function () {
        class ShieldError extends Error {
        }
        const encodedCredentials = Buffer.from(`${credentials.name}:${credentials.pass}`).toString("base64");
        it("should authenticate", function(done) {
            const requestStub = {
                ip: ipAddress,
                headers: {
                    authorization: `Basic ${encodedCredentials}`
                },
                secure: true
            };
            const basicAuth = require("../lib/auth/basic-auth")(authService, ShieldError);
            basicAuth(requestStub, responseStub, done);
        });
    });

    describe("authentication check", function () {
        let tokenResult;
        before(function() {
            return authService.authenticate(credentials, ipAddress)
            .then((token) => {
                tokenResult = token;
            });
        });
        it("should check token", function(done) {
            const setHtmlBaseUrlStub = () => {};
            const requestStub = {
                ip: ipAddress,
                cookies: {
                    "token": tokenResult.signedData
                },
                secure: true
            };
            const authCheck = require("../lib/check-auth")(authService, setHtmlBaseUrlStub);
            const next = (value) => {
                try {
                    assert.equal("route", value);
                    done();
                } catch (error) {
                    done(error);
                }
            };
            authCheck(requestStub, responseStub, next);
        });
    });

    describe("simple Single sign-on", function () {
        it.skip("should exchange key", function() {
            const simpleSSO = require("../lib/auth/simple-sso");
            const logger = {
                error: () => {}
            };
            const options = {
                certs: {
                }
            };
            return simpleSSO(options, logger).then((result) => {
                assert.notEqual(undefined, result);
            });
        });
    });
});