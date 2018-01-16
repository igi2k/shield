const util = require("util");
const formatTime = require("./util/format-time");
const color = require("./util/color");
const morgan = require("morgan");

const stream = getStream();
const format = "shield";

module.exports = {

    stream,
    format,

    log: logOutput,
    error: logOutput,

    init: () => {

        morgan.format(format, (tokens, req, res) => {
            const status = res.statusCode;
            const time = +tokens["response-time"](req, res);
            const size = tokens["res"](req, res, "content-length");

            let responseCodeColor = color.green;
            if (status >= 500) { responseCodeColor = color.red; }
            else if (status >= 400) { responseCodeColor = color.yellow; }
            else if (status >= 300) { responseCodeColor = color.dark.cyan; }

            let timeColor = color.default;
            if (time >= 1000) { timeColor = color.inverted.yellow; }
            else if (time >= 300) { timeColor = color.bold.yellow; }
            else if (time >= 100) { timeColor = color.dark.yellow; }

            const result = [
                `${color.default}`,
                `${tokens["remote-addr"](req, res)} `,
                `${tokens["method"](req, res)} `,
                `${tokens["url"](req, res)} `,
                `${responseCodeColor}`,
                `${tokens["status"](req, res) || "?"} `,
                `${color.reset}${timeColor}${formatTime(time, 300) || "?"}`,
                `${color.reset.default} - ${thousandSeparator(size || "?")}${color.reset}`,
            ];

            return result.join("");
        });

        return morgan;
    }
};

function logOutput(message) {
    // format message
    if (arguments.length > 1) {
        message = util.format.apply(util, arguments);
    }
    stream.write(`${message}\n`);
}

function getStream() {
    if (process.send) { // we're running in cluster
        return {
            write: function (message) {
                process.send({
                    type: "log",
                    data: message
                });
            }
        };
    }
    return process.stdout;
}

function thousandSeparator(number, separator) {
    const groupSize = 3;
    const value = number.toString();
    let length = value.length;
    let result = [];
    while (length > 0) {
        let size = Math.floor(length / groupSize) ? groupSize : (length % groupSize);
        length -= size;
        result.push(value.substr(length, size));
    }

    return result.reverse().join(separator || ",");
}