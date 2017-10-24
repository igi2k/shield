const assert = require("assert");

describe.only("core", function () {
    const core = require("../lib/util/core");
    const key = "key";
    const name = "test";
    const dataResult = "TEST";
    const dataResultEncrypted = "2gy4Yi/i8/dlR6CxgU0yZQ==";

    describe("promisify", function () {
        const value = 3;

        it("should handle value", function (done) {
            function testOk(value, callback) {
                callback(null, value);
            }
            core.promisify(testOk)(value).then((result) => {
                assert.equal(value, result);
                done();
            }).catch(done);
        });
        it("should handle error", function (done) {
            function testError(value, callback) {
                callback(new Error(value));
            }
            core.promisify(testError)(value).then(done).catch((error) => {
                assert.equal(value, error.message);
                done();
            }).catch(done);
        });
    });

    describe("encrypt", function () {
        it("should encrypt", function (done) {
            core.encrypt(dataResult, key, name).then((result) => {
                assert.equal(dataResultEncrypted, result);
                done();
            }).catch(done);
        });
    });

    describe("decrypt", function () {
        it("should decrypt", function (done) {
            core.decrypt(dataResultEncrypted, key, name).then((result) => {
                assert.equal(dataResult, result);
                done();
            }).catch(done);
        });
    });

    describe("generateKey", function () {
        const keySize = 10;

        it("should generate key", function (done) {
            core.generateKey(keySize).then((result) => {
                const data = Buffer.from(result, "hex");
                assert.equal(keySize, data.length);
                //TODO: check uniformity
                done();
            }).catch(done);
        });
    });

    describe("generateSecret", function () {
        const key = "ebc0c4d88a18097638da";
        const ipAddress = "192.168.5.20";

        it("should generate secret", function () {
            const result = core.generateSecret(key, ipAddress);
            assert.equal(key.length / 2 + 4, result.length);
        });
    });

    describe("executeSync", function () {
        const key = "test";
        const value = 10;
        function valueCallback() {
            return Promise.resolve(value);
        }
        it("should execute standalone", function (done) {
            core.executeSync(key, valueCallback).then((result) => {
                assert.equal(value, result);
                done();
            }).catch(done);
        });
    });
});