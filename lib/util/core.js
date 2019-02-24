const { promisify } = require("util");
const stmApi = require("../stm");
const queueApi = require("../stm-queue");

module.exports = {
    promisify: promisify,
    encrypt: encrypt,
    decrypt: decrypt,
    generateKey: generateKey,
    generateSecret: generateSecret,
    executeSync: executeSyncUtil.bind(null, queueApi.region("shield-queue"), stmApi.region("shield")),
    executeSyncUtil: executeSyncUtil
};

const crypto = require("crypto");
const pbkdf2 = promisify(crypto.pbkdf2);
const randomBytes = promisify(crypto.randomBytes);

const cipherKeySize = 192;
const cipherBlockSize = cipherKeySize / 8;
const cipherAlgorithm = `aes-${cipherKeySize}-cbc`;


function createIV(input) { // standard AES block is 128bit
    return crypto.createHash("md5")
    .update(input)
    .digest();
}

function createKey(input, salt) {
    return pbkdf2(input, salt, 1, cipherBlockSize, "sha256");
}

async function createCipherContext(key, name) {
    const keyData = createKey(key, name);
    const ivData = createIV(name);
    return { 
        key: await keyData, 
        iv: ivData 
    };
}

async function encrypt(hash, key, name) {
    const context = await createCipherContext(key, name);
    const cipher = crypto.createCipheriv(cipherAlgorithm, context.key, context.iv);
    const blockSize = context.iv.length;
    const bufferSize = hash.length + (blockSize - hash.length % blockSize);
    
    return new Promise((resolve) => {
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
}

async function decrypt(encryptedHash, key, name) {
    const context = await createCipherContext(key, name);
    const decipher = crypto.createDecipheriv(cipherAlgorithm, context.key, context.iv);
    const decrypted = Buffer.concat(
        [ decipher.update(encryptedHash, "base64"), decipher.final() ]
    );
    return decrypted.toString("utf8");
}

async function generateKey(size) {
    const buffer = await randomBytes(size);
    return buffer.toString("hex");
}

function generateSecret(key, ip) {
    const keyBuffer = Buffer.from(key, "hex");
    const ipBuffer = Buffer.from(new Uint8Array(
        ip.split(".").map(parseInt))
    );
    return Buffer.concat(
        [ keyBuffer, ipBuffer ], keyBuffer.length + ipBuffer.length
    );
}

function executeSyncUtil(queue, stm, key, valueCallback) {

    const loadOperation = async () => {
        const result = await valueCallback();
        const entry = await stm.get(key, { value: { value: result }});
        return entry.value;
    };

    const lockedBlock = async () => {
        const entry = await stm.get(key);
        if (entry) {
            return entry.value;
        }
        return loadOperation();
    };

    return queue.async(key, lockedBlock);
}