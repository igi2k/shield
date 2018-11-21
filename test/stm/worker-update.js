const assert = require("assert");
const stm = require("../../lib/stm");

module.exports = async function workerTask(id, executionLimit) {
    var clientMap = stm.region("clientMap");
    var key = "test";
    if (id === 0) {
        clientMap.clean();
    }

    return clientMap.update(key, (entry) => {
        entry.value = id;
    }, { value: -1 })
    .then((entry) => {
        assert.equal(entry.value, id, JSON.stringify(entry));
        return executionLimit;
    });
};