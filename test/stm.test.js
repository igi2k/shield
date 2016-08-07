/// Shared Memory test
describe('STM', function () {

    describe('standalone', function () {
        it('should count to 50', function (done) {
            this.timeout('15s');
   
            require('./stm/worker')('main', 50).then(function (result) {
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
            var child = require('child_process').fork('./test/stm/master', [50], { execArgv: [] });
            var result;
            child.on('message', function (data) {
                result = data;
            });
            child.on('exit', function (code) {
                if (code === 0) {
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
});