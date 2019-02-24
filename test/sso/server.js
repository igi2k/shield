const http = require("http");
const crypto = require("crypto");
const { parse: parseForm } = require("querystring");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");

const jwtVerify = promisify(jwt.verify);
const jwtSign = promisify(jwt.sign);

function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: "pkcs1",
            format: "pem"
        },
        privateKeyEncoding: {
            type: "pkcs1",
            format: "pem"
        }
    });
    return {
        publicKey: Buffer.from(publicKey),
        privateKey: Buffer.from(privateKey)
    };
}

const normalizeKey = (secret) => {
    return crypto.createHash("sha256")
    .update(secret)
    .digest("hex");
};

async function generateData(signedData, privateKey, publicKey) {
    const { curve, key } = await jwtVerify(signedData, publicKey, { algorithms: ["RS256"] });
    const ecdh = crypto.createECDH(curve);
    const result = ecdh.generateKeys("hex");
    const secret = normalizeKey(ecdh.computeSecret(key, "hex"));

    const signed = await jwtSign({ key: result }, { key: privateKey },
        {
            algorithm: "RS256",
            expiresIn: "1s",
            issuer: "test"
        }
    );

    return { signed, secret };
}

module.exports = async (host) => {

    const { publicKey, privateKey } = generateKeyPair();

    const server = http.createServer(async (request, response) => {
        try {

            const form = await new Promise((resolve, reject) => {
                const body = [];
                request.on("error", reject);
                request.on("data", (chunk) => body.push(chunk));
                request.on("end", () => {
                    try {
                        resolve(parseForm(Buffer.concat(body).toString()));
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            const { signed, secret } = await generateData(form.token, privateKey, publicKey);

            server.secret = secret;
            response.setHeader("authorization", signed);

        } catch (error) {
            response.statusCode = 500;
        }
        response.end();
    });

    return new Promise((resolve, reject) => {
        server.on("error", reject);
        server.listen(null, host, function () {
            const server = this;
            const { address, port } = server.address();
            const url = `http://${address}:${port}`;
            resolve({
                url,
                privateKey,
                publicKey,
                close: () => server.close(),
                get secret() {
                    return server.secret;
                }
            });
        });
    });
};

module.exports.dummySign = async (user) => {
    const dummyKey = normalizeKey("dummy-sso-key");
    return [await jwtSign({ user: user, sso: true }, dummyKey, { expiresIn: "10s" }), dummyKey];
};
