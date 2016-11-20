/// Shared Memory test
describe("STM Queue", function () {
    
    describe("in cluster", function () {
        var maxExecutions = 250;
        var timeout = "5s";

        it(`should execute ${maxExecutions} times`, function (done) {
            this.timeout(timeout);

            var path = require("path").resolve(__dirname, "./cluster/master");
            var child = require("child_process").fork(path, ["../stm-queue/worker", maxExecutions, false], { execArgv: [] });
            var result;
            child.on("message", function (data) {
                result = data;
            });
            child.on("exit", function (code) {
                if (code === 0) {
                    var executions = result.reduce(function (out, result) {
                        return out + result.executions;
                    }, 0);
                    if (executions == maxExecutions) {
                        done();
                    } else {
                        done(new Error(JSON.stringify(result)));
                    }
                } else {
                    done(new Error(code));
                }
            });
        });
    });
});