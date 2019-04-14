const { SERVICE } = require("../util/service-registry");

module.exports = SERVICE("auth-cert", ["authService"], function CertificateAuthenticationFactory(authService) {

    const authenticate = (certificate, ip) => {
        return authService.authenticate((service) => certificateAuthentication(certificate, service), ip);
    };

    return {
        authenticate,
        generateAuthentication: async () => { throw new Error("Generate client certificate") }
    };
});

function certificateAuthentication(certificate, { getUser }) {
    const { subject } = certificate;
    const name = subject["CN"];
    return {
        user: getUser(name, true),
        payload: { user: name, sso: true }
    };
}