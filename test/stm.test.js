/// Shared Memory test
describe('STM', function () {
    
    describe('standalone', function () {
        it('should count to 50', function (done) {
            this.timeout('15s');
            var report = reportFn(this);

            require('./stm/worker')(0, 50).then(function (result) {
                report([result], reportFormatter);
                if ((result.entry.value == result.writes) && result.writes == 50) {
                    done();
                } else {
                    done(new Error(JSON.stringify(result)));
                }
            }, done);
        });
    });

    describe('in cluster', function () {
        it('should count to 50', function (done) {
            this.timeout('5s');
            var report = reportFn(this);

            var path = require('path').resolve(__dirname, "./stm/master");
            var child = require('child_process').fork(path, [50], { execArgv: [] });
            var result;
            child.on('message', function (data) {
                result = data;
            });
            child.on('exit', function (code) {
                if (code === 0) {
                    report(result, reportFormatter);
                    var max = result.reduce(function (out, result) {
                        out.value = Math.max(result.entry.value, out.value);
                        out.writes += result.writes;
                        return out;
                    }, { value: 0, writes: 0 });
                    if ((max.value == max.writes) && max.writes == 50) {
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
        return `    ${output.join(", ")}`;
    }
});