const assert = require("assert");

describe("Utility", function () {
    describe("format-time", function () {
        const formatTime = require("../lib/util/format-time");

        it("undefined", function(){
            assert.equal(undefined, formatTime(undefined));
            assert.equal(undefined, formatTime(+"undefined"));
        });
        
        it("milliseconds", function(){
            assert.equal("500ms", formatTime(500));
        });

        it("seconds", function(){
            assert.equal("5.300s", formatTime(5300));
        });

        it("minutes", function(){
            assert.equal("8:53", formatTime(533000));
        });

        it("hours", function(){
            assert.equal("1h 28:50", formatTime(5330000));
        });

        it("days", function(){
            assert.equal("6d 4h 03:20", formatTime(533000000));
        });

        it("negative", function(){
            assert.equal("-8:53", formatTime(-533000));
            assert.equal("-5.300s", formatTime(-5300));
            assert.equal("-500ms", formatTime(-500));
        });
    });
});