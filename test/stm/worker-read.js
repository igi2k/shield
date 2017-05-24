const stm = require("../../lib/stm");

module.exports = function workerTask(id) {
    var clientMap = stm.region("clientMap");
    var key = "test";
    if (id === 0) {
        clientMap.clean();
    }

    return new Promise(function (resolve, reject) {
        clientMap.get(key).then(function (entry) {
            if (entry == undefined) {
                resolve();
            } else {
                reject(new Error(JSON.stringify(entry)));
            }
        });
    });
};