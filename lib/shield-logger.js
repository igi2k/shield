const util = require("util");
const formatTime = require("./util/format-time");
const color = require("./util/color");

module.exports = {

    format: function (tokens, req, res) {

        var status = res.statusCode;
        var time = +tokens["response-time"](req, res);
        var size = tokens["res"](req, res, "content-length");

        var responseCodeColor = color.green;
        if (status >= 500) { responseCodeColor = color.red; }
        else if (status >= 400) { responseCodeColor = color.yellow; }
        else if (status >= 300) { responseCodeColor = color.dark.cyan; }

        var timeColor = color.default;
        if (time >= 1000) { timeColor = color.inverted.yellow; }
        else if (time >= 300) { timeColor = color.bold.yellow; }
        else if (time >= 100) { timeColor = color.dark.yellow; }

        var format = `${color.default}:remote-addr :method :url ${responseCodeColor}:status`;
        return format.replace(/:([-\w]{2,})(?:\[([^\]]+)])?/g, function (_, name, arg) {
            return (tokens[name](req, res, arg) || "-");
        }) + ` ${color.reset}${timeColor}${formatTime(time, 300) || "?"}${color.reset.default} - ${thousandSeparator(size || "-")}${color.reset}`;
    },

    options: {
        stream: getStream()
    },
    log: logOutput,
    error: logOutput
};

function logOutput(message) {
    var stream = this.options.stream;

    // format message
    if (arguments.length > 1) {
        message = util.format.apply(util, arguments);
    }

    stream.write(message + "\n");
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
    var value = number.toString();
    var length = value.length;
    var size, groupSize = 3;
    var result = [];

    while (length > 0) {
        size = Math.floor(length / groupSize) ? groupSize : (length % groupSize);
        length -= size;
        result.push(value.substr(length, size));
    }

    return result.reverse().join(separator || ",");
}