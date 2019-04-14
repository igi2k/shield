const argon2 = require("argon2");
const core = require("../util/core");
const { SERVICE } = require("../util/service-registry");

module.exports = SERVICE("auth-credentials", ["authService", ".app"], function LocalAuthenticationFactory(authService, app) {
    
    const authenticate = (credentials, ip) => {
        return authService.authenticate((service) => authenticateLocal(app, credentials, service), ip);
    };

    return {
        authenticate, 
        generateAuthentication: (credentials) => generateAuthHash(app.keys.password, credentials)
    };
});

async function authenticateLocal(app, credentials, { getUser }) {
    const { name: username } = credentials;
    const user = await getUser(username);
    const match = await verifyAuthHash(app.keys.password, user.key, credentials);
    if (!match) {
        throw new Error(`Wrong password for user [${username}]`);
    }
    return {
        user,
        payload: { user: username }
    };
}

async function verifyAuthHash(key, encryptedHash, credentials) {
    if (!encryptedHash || credentials.pass == undefined) {
        return false;
    }
    const hash = await core.decrypt(encryptedHash, key, credentials.name);
    return argon2.verify(hash, credentials.pass);
}

async function generateAuthHash(key, credentials) {
    const hash = await argon2.hash(credentials.pass);
    return core.encrypt(hash, key, credentials.name);
}
