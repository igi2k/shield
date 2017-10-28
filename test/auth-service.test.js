const assert = require("assert");

describe("Authentication Service", function () {
    
    const { appStub, ipAddress, credentials, responseStub, LoggerMock } = require("./express/express-stub");
    const AuthService = require("../lib/auth-service");
    const authService = AuthService(appStub);
    
    describe("authenticate", function () {
        const hammeringDelay = 10 * 1000; // 10s

        it("should authenticate", async function() {
            const token = await authService.authenticate(credentials, ipAddress);
            assert.equal(credentials.name, token.user);
        });

        it("should handle wrong user", async function() {
            const loggerMock = new LoggerMock();
            const authService = AuthService(Object.assign({}, appStub, { logger: loggerMock.logger }));
            const wrongCredentials = {
                name: "wrong"
            };
            try {
                await authService.authenticate(wrongCredentials, ipAddress);
            } catch (error) {
                assert.equal("Wrong Credentials", error.message);
                const errorMessage = `Unknown user [${wrongCredentials.name}]`;
                assert.equal(true, loggerMock.containsError(errorMessage), errorMessage);
                return;
            }
            throw new Error("No Error");
        });

        it("should handle wrong password", async function() {
            const loggerMock = new LoggerMock();
            const authService = AuthService(Object.assign({}, appStub, { logger: loggerMock.logger }));
            const wrongCredentials = {
                name: credentials.name
            };
            try {
                await authService.authenticate(wrongCredentials, ipAddress);
            } catch (error) {
                assert.equal("Wrong Credentials", error.message);
                const errorMessage = `Wrong password for user [${wrongCredentials.name}]`;
                assert.equal(true, loggerMock.containsError(errorMessage), errorMessage);
                return;
            }
            throw new Error("No Error");
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
            this.timeout(hammeringDelay * 2 + 500);
            const time = Date.now();
            return withCredentials(wrongCredentials)()
            .catch(withCredentials(wrongCredentials))
            .catch(withCredentials(wrongCredentials))
            .catch(withCredentials(wrongCredentials))
            .catch(withCredentials(credentials))
            .then((token) => {
                const diff = Date.now() - time;
                assert.equal(credentials.name, token.user);
                assert.equal(true, diff > hammeringDelay * 2, `hammering delay ${diff}`);
            });
        });

        afterEach(function() {
            return authService.clearHammering(ipAddress);
        });
    });

    describe("verify", function () {

        const ssoKey = "sso-secret-key";
        const ssoUser = "sso-user";
        let ssoData;
        let tokenData; 

        before(function() {
            const simpleSSO = require("../lib/auth/simple-sso");
            return Promise.all([
                simpleSSO.testSign(ssoUser, ssoKey),
                authService.authenticate(credentials, ipAddress)
            ]).then(([ssoSign, tokenResult]) =>{
                ssoData = ssoSign;
                tokenData = tokenResult.signedData;
            });
        });

        it("should verify authentication", async function() {
            const token = await authService.verify(tokenData, ipAddress);
            assert.equal(credentials.name, token.user);
        });

        it("should verify sso authentication", async function() {
            const authService = AuthService(Object.assign({}, appStub, { 
                sso: { 
                    key: ssoKey
                } 
            }));
            const token = await authService.verify(ssoData, ipAddress);
            assert.equal(ssoUser, token.user);
        });

        it("should fail to verify authentication", async function() {
            try {
                const token = await authService.verify(ssoData, ipAddress);
                assert.notEqual(ssoUser, token.user);
            } catch (error) {
                assert.equal("Wrong Credentials", error.message);
            }
        });
    });

    describe("generateAuthHash", function () {

        it("should generate password hash", async function() {
            const hash = await AuthService.generateAuthHash(credentials, appStub.keys.password);
            assert.equal(true, hash.startsWith(appStub.locals.users[credentials.name].key.substr(0, 20)), "wrong auth hash");
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
        
        class MethodCallMock {
            constructor() {
                this.count = 0;
            }
            get stubMethod() {
                return () => {
                    this.count += 1;
                };
            }
        }

        let tokenData;
        before(async function() {
            const tokenResult = await authService.authenticate(credentials, ipAddress);
            tokenData = tokenResult.signedData;
        });

        it("should check token", function(done) {
            const methodCallMock = new MethodCallMock();
            const requestStub = {
                ip: ipAddress,
                cookies: {
                    "token": tokenData
                },
                secure: true
            };
            const authCheck = require("../lib/check-auth")(authService, methodCallMock.stubMethod);
            const next = (value) => {
                try {
                    assert.equal("route", value);
                    assert.equal(1, methodCallMock.count);
                    done();
                } catch (error) {
                    done(error);
                }
            };
            authCheck(requestStub, responseStub, next);
        });

        it("should handle wrong data", function(done) {
            const methodCallMock = new MethodCallMock();
            const requestStub = {
                ip: ipAddress,
                cookies: {
                    "token": "wrong token"
                }
            };
            const authCheck = require("../lib/check-auth")(authService, methodCallMock.stubMethod);
            const next = (value) => {
                try {
                    assert.equal(undefined, value);
                    assert.equal(1, methodCallMock.count);
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