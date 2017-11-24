module.exports = ReporterEx;

var util = require("util");
var SpecReporter = require("mocha").reporters.Spec;

function ReporterEx(runner) {
    SpecReporter.call(this, runner);
    var indents = 0;

    function indent(extra) {
        return Array(2 * indents + extra || 0).join(" ");
    }

    function reportHook(test) {
        test.ctx.report = function (data, formatter) {
            test.__report = function () {
                try {
                    return formatter.call(this, data);
                } catch(error) {
                    return error;
                }
            };
        };
    }
    runner.on("suite", function () {
        ++indents;
    });
    runner.on("suite end", function () {
        --indents;
    });
    runner.on("test", function (test) {
        reportHook(test);
    });
    runner.on("test end", function (test) {
        var testIndent = test.state == "failed" ? 4 : 3;
        if (test.__report) {
            console.log(indent(testIndent) + test.__report.call()); //eslint-disable-line
        }
    });
}

util.inherits(ReporterEx, SpecReporter);