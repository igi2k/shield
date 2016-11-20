/**
 * Created with IntelliJ IDEA.
 * User: IGI2k
 * Date: 06/08/2014
 */
const cluster = require("cluster");
const winston = require("winston");
const colors = require("winston/node_modules/colors/safe");
const path = require("path");
const fs = require("fs");
const stm = require("./lib/stm");

function startWorker() {
    var worker = cluster.fork();
    var prefix = worker.id + ": ";

    worker.on("message", function (message) { // serialize console logs
        if (message.type == "log") {
            process.stdout.write(prefix + message.data);
        } else if (message.type == "stm") {
            stm.handle(worker, message);
        } else {
            winston.error("unsupported message: %s", JSON.stringify(message));
        }
    });
}

function displayBanner(out) {
    var banner = fs.readFileSync(path.resolve(__dirname, "root", "banner")).toString();
    out.write(colors.yellow.bold(banner) + "\n");
}

if (cluster.isMaster) {

    displayBanner(process.stdout);
    var numCPUs = require("os").cpus().length;

    for (var i = 0; i < numCPUs; i++) {
        startWorker();
    }

    cluster.on("exit", function (worker, code, signal) {
        winston.log("main: Worker %d died with exit code %d (%s)", worker.id, code, signal);
        startWorker();
    });

} else {
    require("./shield")();
}