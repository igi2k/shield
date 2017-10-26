const assert = require("assert");

describe.only("Authentication Service", function () {
    
    const appMock = {
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

    const AuthService = require("../lib/auth-service");
    const authService = AuthService(appMock);

    describe("authenticate", function () {
        it("should authenticate", function() {
            return authService.authenticate(credentials, ipAddress)
            .then((token) => {
                assert.equal(credentials.name, token.user);
            });
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
            return AuthService.generateAuthHash(credentials, appMock.keys.password)
            .then((result) => {
                assert.equal(true, result.startsWith(appMock.locals.users[credentials.name].key.substr(0, 20)));
            });
        });
    });
});