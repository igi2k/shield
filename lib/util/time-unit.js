class TimeUnit {
    constructor(ms) {
        this._ms = ms;
    }

    get ms() {
        return this._ms;
    }
}

const MINUTES = (minutes) => new TimeUnit(minutes * 60 * 1000);
const SECONDS = (seconds) => new TimeUnit(seconds * 1000);
const MS = (ms) => new TimeUnit(ms);

module.exports = {
    MINUTES,
    SECONDS,
    MS
};