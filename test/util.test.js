const assert = require("assert");

describe("Utility", function () {

    const formatTime = require("../lib/util/format-time");

    describe("format-time", function () {

        it("undefined", () => {
            assert.equal(formatTime(undefined), undefined);
            assert.equal(formatTime(+"undefined"), undefined);
        });
        
        it("milliseconds", () => {
            assert.equal(formatTime(500), "500ms");
        });

        it("seconds", () => {
            assert.equal(formatTime(5300), "5.300s");
        });

        it("seconds ignore ms", () => {
            assert.equal(formatTime(5300, undefined, true), "5s");
        });

        it("minutes", () => {
            assert.equal(formatTime(533000), "8:53");
        });

        it("hours", () => {
            assert.equal(formatTime(5330000), "1h 28:50");
        });

        it("days", () => {
            assert.equal(formatTime(533000000), "6d 4h 03:20");
        });

        it("negative", () => {
            assert.equal(formatTime(-533000), "-8:53");
            assert.equal(formatTime(-5300), "-5.300s");
            assert.equal(formatTime(-500), "-500ms");
        });
    });

    describe("pad-number", function() {
        const padNumber = formatTime.padNumber;

        it("shorter", () => {
            assert.equal(padNumber(10, 1), "10");
        });

        it("equal", () => {
            assert.equal(padNumber(10, 2), "10");
        });

        it("larger", () => {
            assert.equal(padNumber(7, 3), "007");
        });

    });

    describe("time-unit", function() {

        const { MINUTES, SECONDS, MS } = require("../lib/util/time-unit");

        it("minutes", () => {
            assert.equal(MINUTES(1).ms, 60000);
        });

        it("seconds", () => {
            assert.equal(SECONDS(2).ms, 2000);
        });

        it("ms", () => {
            assert.equal(MS(2).ms, 2);
        });
    });
});