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
        it("should encrypt", async function () {
            const result = await core.encrypt(dataResult, key, name);
            assert.equal(dataResultEncrypted, result);
        });
    });

    describe("decrypt", function () {
        it("should decrypt", async function () {
            const result = await core.decrypt(dataResultEncrypted, key, name);
            assert.equal(dataResult, result);
        });
    });

    describe("generateKey", function () {
        const keySize = 10;

        it("should generate key", async function () {
            const result = await core.generateKey(keySize);
            const data = Buffer.from(result, "hex");
            assert.equal(keySize, data.length);
            //TODO: check uniformity
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
        const value = 10;

        it("should sync value (standalone)", async function () {
            const result = await core.executeSync("test", () => value);
            assert.equal(value, result);
        });

        it("should sync object (standalone)", async function () {
            const result = await core.executeSync("test-object", () => ({ test: value }));
            assert.equal(value, result.test);
        });
    });
});