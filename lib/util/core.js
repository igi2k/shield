const { promisify } = require("util");

module.exports = {
    promisify: promisify,
    encrypt: encrypt,
    decrypt: decrypt,
    generateKey: generateKey,
    generateSecret: generateSecret,
    executeSync: executeSync
};

const crypto = require("crypto");

const cipherKeySize = 192;
const cipherBlockSize = cipherKeySize / 8;
const cipherAlgorithm = `aes-${cipherKeySize}-cbc`;

function createIV(input) { // standard AES block is 128bit
    const hash = crypto.createHash("md5");
    hash.update(input);
    return hash.digest();
}

function createKey(input, salt) {
    return promisify(crypto.pbkdf2)(input, salt, 1, cipherBlockSize, "sha256");
}

function createCipherContext(key, name) {
    return Promise.all([createKey(key, name), createIV(name)])
    .then(([key, iv]) => {
        return { key, iv };
    });
}

function encrypt(hash, key, name) {
    return createCipherContext(key, name).then((context) => {
        return new Promise((resolve) => {
            const cipher = crypto.createCipheriv(cipherAlgorithm, context.key, context.iv);
            const blockSize = context.iv.length;
            const bufferSize = hash.length + (blockSize - hash.length % blockSize);
            const encrypted = Buffer.alloc(bufferSize);
            let offset = 0;
            cipher.on("readable", () => {
                const data = cipher.read();
                if (data) {
                    offset = data.copy(encrypted, offset);
                }
            });
            cipher.on("end", () => {
                resolve(encrypted.toString("base64"));
            });
            cipher.end(hash);
        });
    });
}

function decrypt(encryptedHash, key, name) {
    return createCipherContext(key, name).then((context) => {
        const decipher = crypto.createDecipheriv(cipherAlgorithm, context.key, context.iv);
        const decrypted = Buffer.concat(
            [ decipher.update(encryptedHash, "base64"), decipher.final() ]
        );
        return Promise.resolve(decrypted.toString("utf8"));
    });
}

function generateKey(size) {
    const randomBytes = promisify(crypto.randomBytes);
    return randomBytes(size)
    .then((buffer) => {
        return buffer.toString("hex");
    });
}

function generateSecret(key, ip) {
    const parts = ip.split(".").map((part) => {
        return parseInt(part);
    });
    const keyBuffer = Buffer.from(key, "hex");
    const ipBuffer = Buffer.from(new Uint8Array(parts));
    return Buffer.concat(
        [ keyBuffer, ipBuffer ], keyBuffer.length + ipBuffer.length
    );
}

const stmApi = require("../stm");
const queueApi = require("../stm-queue");

function executeSync(key, valueCallback) {
    const queue = queueApi.region("queue");
    const stm = stmApi.region("shield");

    function loadOperation() {
        return Promise.resolve(valueCallback())
        .then((result) => {
            return stm.get(key, {}).then((entry) => {
                entry.value = result;
                return stm.set(key, entry).then((entry) => {
                    return entry.value;
                });
            });
        });
    }

    function lockedBlock() {
        return stm.get(key).then((entry) => {
            if (entry) {
                return entry.value;
            }
            return loadOperation();
        });
    }

    return queue.async(key, lockedBlock);
}