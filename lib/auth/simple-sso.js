const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const request = require("request");
const fs = require("fs");
const path = require("path");

const core = require("../util/core");

const jwtSign = core.promisify(jwt.sign);
const jwtVerify = core.promisify(jwt.verify);

const readFile = core.promisify(fs.readFile);

module.exports = function ({ certs, url, cert, rootDir }, logger) {
    return core.executeSync("sso", async () => {
        try {
            return await uploadKey(certs, url, loadCertificate(cert, rootDir));
        } catch (error) {
            logger.error(`SSO: ${error.message}`);
        }
    });
};

async function loadCertificate(input, rootDir) {
    if (typeof input === "string") {
        const filename = path.resolve(rootDir, input);
        return readFile(filename);
    }
    return input;
}
/**
 * @returns {[ crypto.ECDH, string ]}
 */
const createECDH = () => {
    const curve = "secp521r1";
    return [ crypto.createECDH(curve), curve ];
};

const normalizeKey = (secret) => {
    return crypto.createHash("sha256")
    .update(secret)
    .digest("hex");
};

async function uploadKey(certs, url, ssoCertificatePromise) {
    const [ ecdh, curve ] = createECDH();
    const key = ecdh.generateKeys("hex");
    const token = await generateToken({ key, curve }, certs);
    // send token
    return Promise.all([
        core.promisify(request.post)({
            url: url,
            form: { token }
        }), 
        ssoCertificatePromise
    ])
    .then(async ([ httpResponse, ssoCertificate ]) => {
        if (httpResponse.statusCode !== 200) {
            throw new Error(`Server ${httpResponse.statusCode} - ${httpResponse.statusMessage}`);
        }
        const signedData = httpResponse.headers.authorization;
        const token = await jwtVerify(signedData, ssoCertificate, { algorithms: ["RS256"] });
        return normalizeKey(ecdh.computeSecret(token.key, "hex"));
    });
}

function generateToken(payload, { key, passphrase }) {
    return jwtSign(payload, { key, passphrase },
        {
            algorithm: "RS256",
            expiresIn: "10s",
            issuer: "shield"
        }
    );
}