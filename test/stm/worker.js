const stm = require("../../lib/stm");
const retryFn = require("./retry");

module.exports = function workerTask(id, executionLimit, useRetryFn) {

    var clientMap = stm.region("clientMap");

    var key = "test";
    var initialValue = { value: 0 };

    var executions = 0;
    var retries = 0;
    var writes = 0;

    if(id === 0) {
        clientMap.clean();
    }

    return new Promise(function (resolve, reject) {

        function testCase(interval) {
            var intervalId = setInterval(function () {
                if (executions++ >= executionLimit) {
                    clearInterval(intervalId);
                    return;
                }
                clientMap.get(key, initialValue).then(processEntry).catch(handleError);
            }, interval);
        }

        function processEntry(entry) {
            entry = retryFn(entry);
            var retryModule = useRetryFn && "test/stm/retry";
            return clientMap.set(key, entry, retryModule).then(function (entry) {
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
            executions = executionLimit;
            reject(error);
        }

        testCase(500);
        testCase(250);
        testCase(500);
        testCase(250);
        testCase(150);
    });
};
