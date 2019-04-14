const assert = require("assert");

describe("Authentication Service", function () {
    
    const { appStub, ipAddress, credentials, responseStub, LoggerMock } = require("./express/express-stub");
    const AuthService = require("../lib/auth-service");
    const authService = AuthService(appStub);
    const dummyAuth = async (credentials, { getUser }) => {
        return {
            user: await getUser(credentials.name),
            payload: { user: credentials.name }
        };
    };
    const cookieAuthFilter = require("../lib/auth/cookie-auth-filter")(authService, { cookieName: "token" });

    describe("authenticate", function () {
        const hammeringDelay = authService.hammeringDelay;

        it("should authenticate", async function() {
            const token = await authService.authenticate(dummyAuth.bind(null, credentials), ipAddress);
            assert.equal(token.user, credentials.name);
        });

        it("should handle wrong user", async function() {
            const loggerMock = new LoggerMock();
            const authService = AuthService(Object.assign({}, appStub, { logger: loggerMock.logger }));
            const wrongCredentials = {
                name: "wrong"
            };
            try {
                await authService.authenticate(dummyAuth.bind(null, wrongCredentials), ipAddress);
            } catch (error) {
                assert.equal(error.message, "Wrong Credentials");
                const errorMessage = `Unknown user [${wrongCredentials.name}]`;
                assert.equal(loggerMock.containsError(errorMessage), true, errorMessage);
                return;
            }
            throw new Error("No Error");
        });

        it("should handle wrong password", async function() {
            const loggerMock = new LoggerMock();
            const wrongCredentials = {
                name: credentials.name
            };
            const authService = AuthService(Object.assign({}, appStub, { logger: loggerMock.logger }));
            const credentialsService = require("../lib/auth/local-auth-service")(authService, appStub);

            try {
                await credentialsService.authenticate(wrongCredentials, ipAddress);
            } catch (error) {
                assert.equal(error.message, "Wrong Credentials");
                const errorMessage = `Wrong password for user [${wrongCredentials.name}]`;
                assert.equal(loggerMock.containsError(errorMessage), true, errorMessage);
                return;
            }
            throw new Error("No Error");
        });

        it("should protect from hammering", function() {
            const wrongCredentials = {
                name: "wrong"
            };
            const withCredentials = (credentials) => {
                return (error) => {
                    if (error) {
                        assert.equal(error.message, "Wrong Credentials");
                    }
                    return authService.authenticate(dummyAuth.bind(null, credentials), ipAddress);
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
                assert.equal(token.user, credentials.name);
                assert.equal(diff > hammeringDelay * 2, true, `hammering delay ${diff}`);
            });
        });

        afterEach(function() {
            return authService.clearHammering(ipAddress);
        });
    });

    describe("verify", function () {

        const ssoUser = "sso-user";
        const ssoServer = require("./sso/server");

        let ssoData;
        let ssoKey;
        let tokenData; 

        before(async () => {
            [[ssoData, ssoKey], tokenData] = await Promise.all([
                ssoServer.dummySign(ssoUser),
                authService.authenticate(dummyAuth.bind(null, credentials), ipAddress).then(result => result.signedData)
            ]);
        });

        it("should verify authentication", async function() {
            const token = await authService.verify(tokenData, ipAddress);
            assert.equal(token.user, credentials.name);
        });

        it("should verify sso authentication", async function() {
            const authService = AuthService(Object.assign({}, appStub, { 
                sso: { 
                    key: ssoKey
                } 
            }));
            const token = await authService.verify(ssoData, ipAddress);
            assert.equal(token.user, ssoUser);
        });

        it("should fail to verify authentication", async function() {
            try {
                const token = await authService.verify(ssoData, ipAddress);
                assert.notEqual(token.user, ssoUser);
            } catch (error) {
                assert.equal(error.message, "Wrong Credentials");
            }
        });
    });

    describe("Basic authentication", function () {
        const createResponse = (done) => Object.assign({}, responseStub, { shieldError: () => done(new Error("Shield Error")) });
        const createRequest = (credentials) => ({
            ip: ipAddress,
            headers: {
                authorization: `Basic ${credentials}`
            },
            secure: true
        });
        const credentialsService = require("../lib/auth/local-auth-service")(authService, appStub);
        const basicAuth = require("../lib/auth/basic-auth")(credentialsService, cookieAuthFilter);
        
        it("should authenticate", function(done) {
            const encodedCredentials = Buffer.from(`${credentials.name}:${credentials.pass}`).toString("base64");
            basicAuth(createRequest(encodedCredentials), createResponse(done), done);
        });

        it("should not authenticate", function(done) {
            const encodedWrongCredentials = Buffer.from(`${credentials.name}:wrong`).toString("base64");
            basicAuth(createRequest(encodedWrongCredentials), createResponse((error) => done(assert.equal(error.message, "Shield Error"))), done);
        });

        it("should generate password hash", async function() {
            const hash = await basicAuth.generateAuthentication(credentials);
            assert.equal(hash.startsWith(appStub.locals.users[credentials.name].key.substr(0, 20)), true, "wrong auth hash");
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
            const tokenResult = await authService.authenticate(dummyAuth.bind(null, credentials), ipAddress);
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
            const authCheck = require("../lib/check-auth")(cookieAuthFilter.check, methodCallMock.stubMethod);
            const next = (value) => {
                try {
                    assert.equal(value, "route");
                    assert.equal(methodCallMock.count, 1);
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
            const authCheck = require("../lib/check-auth")(cookieAuthFilter.check, methodCallMock.stubMethod);
            const next = (value) => {
                try {
                    assert.equal(value, undefined);
                    assert.equal(methodCallMock.count, 1);
                    done();
                } catch (error) {
                    done(error);
                }
            };
            authCheck(requestStub, responseStub, next);
        });
    });

    describe("simple Single sign-on", function () {

        let server;

        before(async () => {
            server = await require("./sso/server")("localhost");
        });

        after(() => {
            server.close();
        });

        it("should exchange key", function() {
            const simpleSSO = require("../lib/auth/simple-sso");
            const logger = {
                error: () => {}
            };
            const options = {
                url: server.url,
                cert: server.publicKey,
                certs: {
                    key: server.privateKey
                }
            };
            return simpleSSO(options, logger).then((result) => {
                assert.equal(result, server.secret);
            });
        });
    });
});