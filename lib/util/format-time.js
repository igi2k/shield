module.exports = formatTime;
module.exports.padNumber = padNumber;

/**
 * Format number by padding it with leading zeroes
 * @param {Number} num source value
 * @param {Number} length desired minimum target length
 * @returns {String} padded number
 */
function padNumber(num, length) {
    const value = `${num}`;
    const zeroes = Math.max(length - value.length, 0);
    return `${"0".repeat(zeroes)}${value}`;
}

/**
 * Format given time (ms) to human readable output
 * @param {Number} ms input in milliseconds
 * @param {Number} [msThreshold] threshold for formatting milliseconds, what's over threshold is displayed as 0.{ms}s
 * @param {Number} [msHide] hide milliseconds
 * @returns {String} formatted time
 */
function formatTime(ms, msThreshold, msHide) {

    /**
     * Format time from one minute and above
     * @param timeArray variable array of parsed values [days, hours, minutes, seconds, milliseconds]
     * @returns {string}
     */
    function largeTime(timeArray) {
        const marks = ["", ":", "h ", "d "];
        let marksIndex = 0;
        let result = [];
        do {
            if (result.length) {
                result.push(marks[marksIndex++]);
            }
            // take values from the end and pad numbers except for days
            result.push(padNumber(timeArray.pop(), (timeArray.length && marksIndex <= 2) ? 2 : 0));
        } while (timeArray.length);
        return result.slice(2).reverse().join(""); // ignore milliseconds
    }

    /**
     * Format time
     * @param timeArray variable array of parsed values [days, hours, minutes, seconds, milliseconds]
     * @returns {string}
     */
    function format(timeArray) {
        let result;
        if (timeArray.length <= 1) { // format milliseconds
            if (timeArray.length == 1 && timeArray[0] >= msThreshold) {
                timeArray.unshift(0);
                return format(timeArray);
            }
            result = ms + "ms";
        } else if (timeArray.length == 2) { // formats seconds till 59.999s
            result = ms < 0 ? -timeArray[0] : timeArray[0];
            if (!msHide) {
                result += "." + timeArray[1];
            }
            result += "s";
        } else { // one minute and above
            result = ms < 0 ? "-" + largeTime(timeArray) : largeTime(timeArray);
        }
        return result;
    }

    if (isNaN(ms)) {
        return;
    }
    let time = [];
    let part = Math.floor(Math.abs(ms));
    const div = [1000, 60, 60, 24]; // time slices: milliseconds, minutes, hours, days
    for (let i = 0; i < div.length; i++) {
        let tmp = part % div[i];
        time.push(tmp);
        part = (part - tmp) / div[i];
    }
    time.push(part);

    // find leading zeroes
    part = time.length;
    while (--part > 0) {
        if (time[part] !== 0) {
            break;
        }
    }
    // filter out values with zeroes and prepare output as variable array in this order [days, hours, minutes, seconds, milliseconds]
    return format(time.slice(0, part + 1).reverse());
}