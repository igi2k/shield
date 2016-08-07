const util = require("util");
const formatTime = require("./util/format-time");

module.exports = {

    format: function (tokens, req, res) {

        var color = 32; // green
        var timeColor = 90; //default

        var status = res.statusCode;

        if (status >= 500) color = 31; // red
        else if (status >= 400) color = 33; // yellow
        else if (status >= 300) color = "36;2"; // cyan dark

        var time = +tokens["response-time"](req, res);
        if (time >= 1000) {
            timeColor = "33;7"; //inverted
        }
        else if (time >= 300) {
            timeColor = "33;1"; // yellow
        }
        else if (time >= 100) {
            timeColor = "33;2";
        }

        var size = tokens["res"](req, res, "content-length");

        var format = "\x1b[90m:remote-addr :method :url \x1b[" + color + "m:status";
        return format.replace(/:([-\w]{2,})(?:\[([^\]]+)])?/g, function (_, name, arg) {
            return (tokens[name](req, res, arg) || "-");
        }) + " \x1b[" + timeColor + "m" + formatTime(time, 300) + "\x1b[0m\x1b[90m - " + thousandSeparator(size || "-") + "\x1b[0m";
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

