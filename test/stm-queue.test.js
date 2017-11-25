/// Shared Memory test
describe("STM Queue", function () {

    describe("standalone", function () {
        const maxExecutions = 50;
        const timeout = "10s";

        it(`should execute ${maxExecutions} times`, function () {
            this.timeout(timeout);

            return require("./stm-queue/worker")(0, maxExecutions).then((result) => {
                if (result.executions !== maxExecutions) {
                    throw new Error(JSON.stringify(result));
                }
            });

        });
    });

    describe("in cluster", function () {
        const { execute } = require("./cluster/cluster-util");
        const maxExecutions = 250;
        const timeout = "5s";

        it(`should execute ${maxExecutions} times`, function () {
            this.timeout(timeout);

            return execute(["../stm-queue/worker", maxExecutions, false]).then((result) => {
                const executions = result.reduce((out, result) => {
                    return out + result.executions;
                }, 0);
                if (executions !== maxExecutions) {
                    throw new Error(JSON.stringify(result));
                }
            });
        });
    });
});