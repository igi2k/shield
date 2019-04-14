const { SERVICE } = require("../util/service-registry");
const { SECONDS } = require("../util/time-unit");

module.exports = SERVICE("authentication", ["auth-cert", ".config"], function CertificateAuthHandlerFactory(authService, { cookieName }) {

    // uses client certificate authentication
    return Object.assign(function CertificateAuthHandler(req, res, next) {
        if (!req.secure) {
            return next(new Error("Non encrypted connection."));
        }

        getCertificate(req).then((certificate) => {
            if (!certificate) {
                return unauthorized(res, next);
            }
            return authService.authenticate(certificate, req.ip).then((token) => {
                res.locals.auth = token;
                res.cookie(cookieName, token.signedData, {
                    httpOnly: true,
                    secure: true,
                    expires: new Date(SECONDS(token.exp).ms)
                });
                next();
            }, () => {
                unauthorized(res, next);
            });

        })
        .catch(next);
    }, {
        generateAuthentication: (credentials) => authService.generateAuthentication(credentials)
    });
});

function unauthorized(res, next) {
    res.status(401).shieldError(next, "401", { title: "401" });
}

function clientCertificate(client) {
    if (!client.authorized) {
        return null;
    }
    return client.getPeerCertificate();
}

function renegotiate(client) {
    return new Promise((resolve, reject) => {
        client.renegotiate({ requestCert: true, rejectUnauthorized: false }, (error) => {
            client.disableRenegotiation();
            if (error) {
                return reject(error);
            }
            resolve(clientCertificate(client));
        });
    });
}

async function getCertificate({ client }) {
    return clientCertificate(client) || await renegotiate(client);
}