const stm = require("../../lib/stm");

module.exports = async function workerTask(id) {
    var clientMap = stm.region("clientMap");
    var key = "test";
    if (id === 0) {
        clientMap.clean();
    }

    return clientMap.get(key).then((entry) => {
        if (entry != undefined) {
            throw new Error(JSON.stringify(entry));
        }
    });
};