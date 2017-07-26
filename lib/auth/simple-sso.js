const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const request = require("request");

const core = require("../util/core");
const stmApi = require("../stm");
const queueApi = require("../stm-queue");

module.exports = function (options, logger) {
    const queue = queueApi.region("queue");
    const stm = stmApi.region("shield");
    const key = "sso";

    function loadOperation() {
        return uploadKey(options)
        .catch((error) => {
            logger.error(`SSO: ${error.message}`);
        })
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
};

function uploadKey({ certs, url }) {
    const curve = "secp521r1";
    const ecdh = crypto.createECDH(curve);
    const key = ecdh.generateKeys("hex");
    return generateToken({ key, curve }, certs)
    .then((token) => { // send token
        return new Promise((resolve, reject) => {
            request.post({
                url: url,
                form: { token }
            }, function (err, httpResponse) {
                if (err) {
                    return reject(err);
                }
                if (httpResponse.statusCode !== 200) {
                    return reject(new Error(`Server ${httpResponse.statusCode} - ${httpResponse.statusMessage}`));
                }

                const key = httpResponse.headers.authorization;
                try {
                    const secret = ecdh.computeSecret(key, "hex");
                    const hash = crypto.createHash("sha256");
                    hash.update(secret);
                    resolve(hash.digest("hex"));
                } catch (error) {
                    reject(error);
                }
            });
        });
    });
}

function generateToken(payload, certs) {
    const key = certs.key;
    const passphrase = certs.passphrase;
    const sign = core.promisify(jwt.sign);

    return sign(payload, { key, passphrase },
        {
            algorithm: "RS256",
            expiresIn: "10s",
            issuer: "shield"
        }
    );
}