/// Shared Memory test
describe("STM", function () {

    describe("standalone", function () {
        const maxExecutions = 50;
        const timeout = "10s";

        it("should handle empty values", () => {
            return require("./stm/worker-read")(0);
        });

        it("should execute in context", () => {
            require("./stm/worker-execute")(0);
        });

        function validate(result) {
            if (!((result.entry.value == result.writes) && result.writes == maxExecutions)) {
                throw new Error(JSON.stringify(result));
            }
        }

        it(`should count to ${maxExecutions}`, function () {
            this.timeout(timeout);
            const report = reportFn(this);

            return require("./stm/worker")(0, maxExecutions).then((result) => {
                report([result], reportFormatter);
                validate(result);
            });
        });

        it(`should count to ${maxExecutions} with fn`, function () {
            this.timeout(timeout);
            const report = reportFn(this);

            return require("./stm/worker")(0, maxExecutions, true).then((result) => {
                report([result], reportFormatter);
                validate(result);
            });
        });
    });

    describe("in cluster", function () {
        const master = require("path").resolve(__dirname, "./cluster/master");
        const maxExecutions = 250;
        const timeout = "5s";
        
        function execute([workerPath, writes, useRetryFn], cwd) {
            const childProcess = require("child_process");
            return new Promise((resolve, reject) => {
                let result;                
                const child = childProcess.fork(master, [workerPath, writes, useRetryFn], { execArgv: [], cwd: cwd });
                child.on("message", (data) => {
                    result = data;
                });
                child.on("exit", (code) => {
                    if (code === 0) {
                        resolve(result);
                    } else {
                        reject(new Error(code));
                    }
                });
            });
        }

        function validate(result, maxExecutions) {
            const max = result.reduce((out, result) => {
                out.value = Math.max(result.entry.value, out.value);
                out.writes += result.writes;
                return out;
            }, { value: 0, writes: 0 });

            if (!((max.value == max.writes) && max.writes == maxExecutions)) {
                throw new Error(JSON.stringify(result));
            }
        }

        it("should handle empty values", function () {
            this.timeout(timeout);

            return execute(["../stm/worker-read", maxExecutions, false])
            .then((result) => {
                const isUndefined = result.reduce((out, result) => {
                    return (out && result == undefined);
                }, true);

                if(!isUndefined) {
                    throw new Error(JSON.stringify(result));
                }
            });
        });

        it("should execute in context", function () {
            this.timeout(timeout);

            return execute(["../stm/worker-execute", maxExecutions, false])
            .then((result) => {
                const count = result.reduce((out, result) => {
                    return (out + result);
                }, 0);

                if(count != maxExecutions) {
                    throw new Error(JSON.stringify(result));
                }
            });
        });

        it(`should count to ${maxExecutions}`, function () {
            this.timeout(timeout);
            const report = reportFn(this);

            return execute(["../stm/worker", maxExecutions, false])
            .then((result) => {
                report(result, reportFormatter);
                validate(result, maxExecutions);
            });
        });

        it(`should count to ${maxExecutions} with fn`, function () {
            this.timeout(timeout);
            const report = reportFn(this);

            const cwd = require("path").resolve(__dirname, "..");
            
            return execute(["../stm/worker", maxExecutions, true], cwd)
            .then((result) => {
                report(result, reportFormatter);
                validate(result, maxExecutions);
            });
        });
    });

    function reportFn(context) {
        return context.report || function () { };
    }
    function reportFormatter(data) {
        var ordered = data.sort((a, b) => {
            return a.worker - b.worker;
        });
        var output = ordered.map((result) => {
            var overhead = (result.retries / result.writes) * 100;
            return `${result.writes}/${result.retries} (${overhead.toFixed(0)}%)`;
        });
        return output.join(", ");
    }
});