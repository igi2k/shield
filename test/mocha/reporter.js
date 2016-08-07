module.exports = ReporterEx;

var util = require('util');
var SpecReporter = require("mocha").reporters.Spec;

function ReporterEx(runner) {
    SpecReporter.call(this, runner);
    var indents = 0;

    indent = function() {
        return Array(indents).join('  ');
    }

    function reportHook(test) {
        test.ctx.report = function (data, formatter) {
            test.__report = function() {
                return formatter.call(this, data);
            }
        };
    }
    runner.on("suite", function(test){
        ++indents;
    });
    runner.on("suite end", function(test){
        --indents;
    });
    runner.on("test", function(test){
        reportHook(test);
    });
    runner.on("test end", function(test){
        if(test.__report) {
            console.log(indent() + test.__report.call());
        }
    });
}

util.inherits(ReporterEx, SpecReporter);