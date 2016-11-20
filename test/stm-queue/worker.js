const stmQueue = require("../../lib/stm-queue");

module.exports = function workerTask(id, executionLimit) {
    var queue = stmQueue.region("queue");
    var key = "test";
    var executions = [];

    return new Promise(function (resolve, reject) {

        function testCase(interval) {
            var intervalId = setInterval(function () {
                if (executions.length == executionLimit) {
                    clearInterval(intervalId);
                    return;
                }
                executions.push(queue.async(key, lockedBlock).then(function (id) {
                    // console.log(id, executionLimit);
                }));
                if (executions.length == executionLimit) {
                    Promise.all(executions).then(function () {
                        resolve({
                            worker: id,
                            executions: executions.length,
                        });
                    }).catch(reject);
                }
                function lockedBlock(id) {
                    return Promise.resolve(id);
                }

            }, interval);
        }

        testCase(500);
        testCase(250);
        testCase(500);
        testCase(250);
        testCase(150);
    });
};