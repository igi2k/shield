const assert = require("assert");

describe("core", function () {
    const core = require("../lib/util/core");
    const key = "key";
    const name = "test";
    const dataResult = "TEST";
    const dataResultEncrypted = "2gy4Yi/i8/dlR6CxgU0yZQ==";

    describe("promisify", function () {
        const value = 3;

        function testOk(value, callback) {
            callback(null, value);
        }
        function testError(value, callback) {
            callback(new Error(value));
        }

        it("should handle value", function () {
            return core.promisify(testOk)(value).then((result) => {
                assert.equal(value, result);
            });
        });
        it("should handle error", function () {
            return core.promisify(testError)(value).then(() => { throw new Error("No Error"); }).catch((error) => {
                assert.equal(value, error.message);
            });
        });
    });

    describe("encrypt", function () {
        it("should encrypt", function () {
            return core.encrypt(dataResult, key, name).then((result) => {
                assert.equal(dataResultEncrypted, result);
            });
        });
    });

    describe("decrypt", function () {
        it("should decrypt", function () {
            return core.decrypt(dataResultEncrypted, key, name).then((result) => {
                assert.equal(dataResult, result);
            });
        });
    });

    describe("generateKey", function () {
        const keySize = 10;

        it("should generate key", function () {
            return core.generateKey(keySize).then((result) => {
                const data = Buffer.from(result, "hex");
                assert.equal(keySize, data.length);
                //TODO: check uniformity
            });
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
        it("should execute standalone", function () {
            return core.executeSync(key, valueCallback).then((result) => {
                assert.equal(value, result);
            });
        });
    });
});