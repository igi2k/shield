const stm = require('../../lib/stm');

module.exports = function workerTask(id, executionLimit) {

    var clientMap = stm.region("clientMap");

    var key = "test";
    var initialValue = { value: 0 };

    var retries = 0;
    var writes = 0;

    return new Promise(function (resolve, reject) {

        function testCase(interval) {
            var id = setInterval(function () {
                if (writes == executionLimit) {
                    clearInterval(id);
                    return; // edge case? sometimes there is +1 writes
                }
                clientMap.get(key, initialValue).then(processEntry).catch(handleError);
            }, interval);
        }

        function processEntry(entry) {
            entry.value++;
            return clientMap.set(key, entry).then(function (entry) {
                if (++writes == executionLimit) {
                    resolve({
                        worker: id,
                        retries: retries,
                        writes: writes,
                        entry: entry
                    });
                }
            }, function (entry) { // stm error
                retries++;
                return processEntry(entry);
            });
        }

        function handleError(error) {
            retries = executionLimit;
            reject(error);
        }

        testCase(1000);
        testCase(500);
        testCase(1000);
    });
};
