var fs = require('fs');
var path = require('path');

function loadFile(value, rootDir) {
    return fs.readFileSync(path.resolve(rootDir, value));
}

function loadFileProperties(tls, rootDir){
    function checkAndLoad(property) {
        if(!tls.hasOwnProperty(property)){
            return;
        }
        var value = tls[property];
        if(typeof value === 'string'){
            this[property] = loadFile(value, rootDir);
        }
    }
    ['key', 'cert', 'ca'].forEach(checkAndLoad, tls);
    return tls;
}

function setup(tls, rootDir) {
    if (tls) {
        return loadFileProperties(tls, rootDir);
    }
}

function create(app, options) {
    var type = "http";
    var params = [app];
    if (options) {
        type = "https";
        params.unshift(options);
    }
    var lib = require(type);
    var server = lib.createServer.apply(lib, params);
    server.type = type;
    return server;
}

module.exports = {
    create: function(settings, app, cb) {
        var options = setup(settings.tls, settings.rootDir);
        return create(app, options).listen(settings.port, settings.hostname, cb);
    }
};