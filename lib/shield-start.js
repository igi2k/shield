const fs = require("fs");
const path = require("path");
const core = require("./util/core");

function loadFileProperties(tls, rootDir) {
    const readFile = core.promisify(fs.readFile);
    function checkAndLoad(property) {
        const value = tls[property];
        if (typeof value === "string") {
            const filename = path.resolve(rootDir, value);
            return readFile(filename).then(content => {
                tls[property] = content;
            });
        }
    }
    return Promise.all(["key", "cert", "ca"].map(checkAndLoad)).then(() => {
        return tls;
    });
}

function setup(tls, rootDir) {
    if (tls) {
        return loadFileProperties(tls, rootDir);
    }
    return Promise.resolve();
}

function create(app, options) {
    let type = "http";
    let params = [app];
    if (options) {
        type = "https";
        params.unshift(options);
    }
    const lib = require(type);
    let server = lib.createServer.apply(lib, params);
    server.type = type;
    return server;
}

module.exports = {
    create: function (settings, app) {
        return setup(settings.tls, settings.rootDir)
        .then(options => {
            return create(app, options);
        });
    }
};