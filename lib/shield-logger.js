var util = require("util");

module.exports = {
    
    format: function(tokens, req, res){
        
        var color = 32; // green
        var timeColor = 90; //default

        var status = res.statusCode;

        if (status >= 500) color = 31; // red
        else if (status >= 400) color = 33; // yellow
        else if (status >= 300) color = "36;2"; // cyan dark

        var time = +tokens['response-time'](req, res);
        if(time >= 1000){
            timeColor = "33;7"; //inverted
        }
        else if(time >= 300){
            timeColor = "33;1"; // yellow
        }
        else if(time >= 100){
            timeColor = "33;2";
        }

        var size = tokens['res'](req, res, 'content-length');

        var format = "\x1b[90m:remote-addr :method :url \x1b[" + color + "m:status";
        return format.replace(/:([-\w]{2,})(?:\[([^\]]+)])?/g, function(_, name, arg){
                return (tokens[name](req, res, arg) || "-");
            }) +" \x1b[" + timeColor  + "m" + formatTime(time, 300) + "\x1b[0m\x1b[90m - " + thousandSeparator(size || '-') + "\x1b[0m";
    },
    
    options: {
        stream: getStream()
    },
    
    log: logOutput,
    
    error:logOutput
};


function logOutput(message) {
    var stream = this.options.stream;
    
    // format message
    if(arguments.length > 1) {
        message = util.format.apply(util, arguments);
    }
    
    stream.write(message + "\n");
}

function getStream(){
    if(process.send){ // we're running in cluster
        return {
            write: function (message) {
                process.send({
                    type: 'log',
                    data: message
                });
            }
        };
    }
    return process.stdout;
}

function thousandSeparator(number, separator){
    var value = number.toString();
    var length = value.length;
    var size, groupSize = 3;
    var result = [];

    while(length > 0){
        size = Math.floor(length / groupSize)? groupSize : (length % groupSize);
        length -= size;
        result.push(value.substr(length, size));
    }

    return result.reverse().join(separator || ',');
}

/**
 * Format number by padding it with leading zeroes (currently supported length is 3)
 * @param {Number} num source value
 * @param {Number} length desired minimum padding length
 * @returns {String} padded number
 */
function padNumber(num, length){
    var str = num.toString();
    var zeroes = Math.max(length - str.length + 1, 0);
    return new Array(zeroes).join('0') + str;
}

/**
 * Format given time (ms) to human readable output
 * @param {Number} ms input in milliseconds
 * @param {Number} [msThreshold] threshold for formatting milliseconds, what's over threshold is displayed as 0.{ms}s
 * @param {Number} [msHide] hide milliseconds
 * @returns {String} formatted time
 */
function formatTime(ms, msThreshold, msHide){

    /**
     * Format time from one minute and above
     * @param timeArray variable array of parsed values [days, hours, minutes, seconds, milliseconds]
     * @returns {string}
     */
    function largeTime(timeArray){
        var marks = ['', ':', 'h ', 'd '];
        var marksIndex = 0;
        var result = [];
        do {
            if(result.length){
                result.push(marks[marksIndex++]);
            }
            // take values from the end and pad numbers except for days
            result.push(padNumber(timeArray.pop(), (timeArray.length && marksIndex <= 2)? 2 : 0));
        } while(timeArray.length);
        return result.slice(2).reverse().join(''); // ignore milliseconds
    }

    /**
     * Format time
     * @param timeArray variable array of parsed values [days, hours, minutes, seconds, milliseconds]
     * @returns {string}
     */
    function format(timeArray){
        var result;
        if(timeArray.length <= 1){ // format milliseconds
            if(timeArray.length == 1 && timeArray[0] >= msThreshold){
                timeArray.unshift(0);
                return format(timeArray);
            }
            result = ms + "ms";
        }else if(timeArray.length == 2){ // formats seconds till 59.999s
            result = timeArray[0];
            if(!msHide) {
                result += "." + timeArray[1];
            }
            result += "s";
        }else { // one minute and above
            result = largeTime(timeArray);
        }
        return result;
    }

    var time = [];
    var div = [1000, 60, 60, 24]; // time slices: milliseconds, minutes, hours, days
    var part = Math.floor(ms);
    for(var i = 0; i < div.length; i++){
        var tmp = part % div[i];
        time.push(tmp);
        part = (part - tmp) / div[i];
    }
    time.push(part);

    // find leading zeroes
    part = time.length;
    while(--part > 0) {
        if (time[part] !== 0) {
            break;
        }
    }
    // filter out values with zeroes and prepare output as variable array in this order [days, hours, minutes, seconds, milliseconds]
    return format(time.slice(0, part + 1).reverse());
}