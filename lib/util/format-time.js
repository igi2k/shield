module.exports = formatElapsedTime;
module.exports.padNumber = padNumber;

/**
 * Format number by padding it with leading zeroes
 * @param {number} num source value
 * @param {number} length desired minimum target length
 * @returns {string} padded number
 */
function padNumber(num, length) {
    return `${num}`.padStart(length, "0");
}

/**
 * Format given time (ms) to human readable output
 * @param {number} ms input in milliseconds
 * @param {number} [msThreshold] threshold for formatting milliseconds, what's over threshold is displayed as 0.{ms}s
 * @param {boolean} [msHide] hide milliseconds
 * @returns {string} formatted time
 */
function formatElapsedTime(ms, msThreshold, msHide) {

    if (isNaN(ms)) {
        return;
    }

    const time = [Math.abs(Math.trunc(ms)), 1000, 60, 60, 24]; // time slices: milliseconds, minutes, hours, days
    for (let i = 0; i < time.length - 1; i++) {
        const sliceIndex = i + 1;
        const remaining = time[i];
        const part = remaining % time[sliceIndex];
        time[i] = part;
        time[sliceIndex] = (remaining - part) / time[sliceIndex];
    }

    const nonZeroIndex = time.reverse().findIndex((part) => !!part);
    // filter out values with zeroes and prepare output as variable array in this order [days, hours, minutes, seconds, milliseconds]
    const result = formatTimeArray(time.slice(nonZeroIndex), msThreshold, msHide);
    return ms < 0 ? `-${result}` : result;
}

const TimeDelimiters = ["d ", "h ", ":", "."];

/**
 * Format time
 * @param timeArray variable array of parsed values [days, hours, minutes, seconds, milliseconds]
 * @param {number} [msThreshold] threshold for formatting milliseconds, what's over threshold is displayed as 0.{ms}s
 * @param {boolean} [msHide] hide milliseconds
 * @returns {string}
 */
function formatTimeArray(timeArray, msThreshold, msHide) {
    switch (timeArray.length) {
    case 1: // format milliseconds
        if (timeArray[0] >= msThreshold) {
            timeArray.unshift(0);
        } else {
            return `${timeArray[0]}ms`;
        }
        // falls through
    case 2:  // formats seconds till 59.999s
        return !msHide ? `${timeArray[0]}.${timeArray[1]}s` : `${timeArray[0]}s`;
    default: { // one minute and above
        const delimiters = TimeDelimiters.slice(1 - timeArray.length);
        const result = new Array(2 * timeArray.length - 1);
        let marksIndex = 0;
        let i = 0;
        do {
            // pad numbers except for days/hours and whey they are not first
            result[i] = padNumber(timeArray.shift(), (i === 0 || i === 2 && delimiters.length === TimeDelimiters.length) ? 0 : 2);
            if (i > 0) {
                result[i - 1] = delimiters[marksIndex++];
            }
            i += 2;
        } while (timeArray.length);
        return result.slice(0, result.length - 2).join(""); // ignore milliseconds
    }}
}