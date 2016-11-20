/// Shared Memory test
describe("STM", function () {
    
    describe("standalone", function () {
        var maxExecutions = 50;
        var timeout = "10s";

        it(`should count to ${maxExecutions}`, function (done) {
            this.timeout(timeout);
            var report = reportFn(this);

            require("./stm/worker")(0, maxExecutions).then(function (result) {
                report([result], reportFormatter);
                if ((result.entry.value == result.writes) && result.writes == maxExecutions) {
                    done();
                } else {
                    done(new Error(JSON.stringify(result)));
                }
            }, done);
        });

        it(`should count to ${maxExecutions} with fn`, function (done) {
            this.timeout(timeout);
            var report = reportFn(this);
            
            require("./stm/worker")(0, maxExecutions, true).then(function (result) {
                report([result], reportFormatter);
                if ((result.entry.value == result.writes) && result.writes == maxExecutions) {
                    done();
                } else {
                    done(new Error(JSON.stringify(result)));
                }
            }, done);
        });
    });

    describe("in cluster", function () {
        var maxExecutions = 250;
        var timeout = "5s";

        it(`should count to ${maxExecutions}`, function (done) {
            this.timeout(timeout);
            var report = reportFn(this);

            var path = require("path").resolve(__dirname, "./cluster/master");
            var child = require("child_process").fork(path, ["../stm/worker", maxExecutions, false], { execArgv: [] });
            var result;
            child.on("message", function (data) {
                result = data;
            });
            child.on("exit", function (code) {
                if (code === 0) {
                    report(result, reportFormatter);
                    var max = result.reduce(function (out, result) {
                        out.value = Math.max(result.entry.value, out.value);
                        out.writes += result.writes;
                        return out;
                    }, { value: 0, writes: 0 });
                    if ((max.value == max.writes) && max.writes == maxExecutions) {
                        done();
                    } else {
                        done(new Error(JSON.stringify(result)));
                    }
                } else {
                    done(new Error(code));
                }
            });
        });

        it(`should count to ${maxExecutions} with fn`, function (done) {
            this.timeout(timeout);
            var report = reportFn(this);

            var path = require("path").resolve(__dirname, "./cluster/master");
            var cwd = require("path").resolve(__dirname, "..");
            var child = require("child_process").fork(path, ["../stm/worker", maxExecutions, true], { execArgv: [], cwd: cwd });
            var result;
            child.on("message", function (data) {
                result = data;
            });
            child.on("exit", function (code) {
                if (code === 0) {
                    report(result, reportFormatter);
                    var max = result.reduce(function (out, result) {
                        out.value = Math.max(result.entry.value, out.value);
                        out.writes += result.writes;
                        return out;
                    }, { value: 0, writes: 0 });
                    if ((max.value == max.writes) && max.writes == maxExecutions) {
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
    
    function reportFn(context) {
        return context.report || function(){};
    }
    function reportFormatter(data){
        var ordered = data.sort(function(a, b){
            return a.worker - b.worker;
        });
        var output = ordered.map(function(result){
            var overhead = (result.retries/result.writes) * 100;
            return `${result.writes}/${result.retries} (${overhead.toFixed(0)}%)`;
        });
        return output.join(", ");
    }
});