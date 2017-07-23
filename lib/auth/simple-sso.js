const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const request = require("request");
const dns = require("dns");
const URL = require("url");

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
    return generateKey().then((generatedKey) => {
        return dnsResolve(url).then((ip) => {
            const key = `${generatedKey}${ip}`;
            return generateToken({ key }, certs)
            .then((token) => { // send token
                return new Promise((resolve, reject) => {
                    request.post({
                        url: url,
                        form: { token }
                    }, function (err, httpResponse) {
                        if (err) {
                            return reject(err);
                        }
                        if(httpResponse.statusCode !== 200) {
                            return reject(new Error(`Server ${httpResponse.statusCode} - ${httpResponse.statusMessage}`));
                        }
                        resolve();
                    });
                });
            });
        })
        .then(() => {
            return generatedKey;
        });
    });
}

function dnsResolve(url) {
    const hostname = new URL.parse(url).hostname;
    const lookup = core.promisify(dns.lookup);
    return lookup(hostname);
}

function generateKey() {
    const randomBytes = core.promisify(crypto.randomBytes);
    return randomBytes(48)
    .then((buffer) => {
        return buffer.toString("hex");
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