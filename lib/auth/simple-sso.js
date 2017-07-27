const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const request = require("request");
const fs = require("fs");
const path = require("path");

const core = require("../util/core");

module.exports = function (options, logger) {
    return core.executeSync("sso", () => {
        return uploadKey(options)
        .catch((error) => {
            logger.error(`SSO: ${error.message}`);
        });
    });
};

function loadCertificate(input, rootDir) {
    return new Promise((resolve, reject) => {
        if (typeof input === "string") {
            const readFile = core.promisify(fs.readFile);
            const filename = path.resolve(rootDir, input);
            return readFile(filename).then(resolve, reject);
        }
        resolve(input);
    });
}

function uploadKey({ certs, url, cert, rootDir }) {
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

                const signedData = httpResponse.headers.authorization;
                loadCertificate(cert, rootDir)
                .then((cert) => {
                    const verify = core.promisify(jwt.verify);
                    return verify(signedData, cert, { algorithms: ["RS256"] });
                })
                .then((token) => {
                    const secret = ecdh.computeSecret(token.key, "hex");
                    const hash = crypto.createHash("sha256");
                    hash.update(secret);
                    return hash.digest("hex");
                }).then(resolve, reject);
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