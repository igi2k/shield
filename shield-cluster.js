/**
 * Created with IntelliJ IDEA.
 * User: IGI2k
 * Date: 06/08/2014
 */
const cluster = require("cluster");
const color = require("./lib/util/color");
const path = require("path");
const fs = require("fs");
const stm = require("./lib/stm");
const queue = require("./lib/stm-queue");
const { version } = require(path.join(__dirname, "package.json"));

function startWorker() {
    const worker = cluster.fork();
    const prefix = `${worker.id}: `;

    worker.on("message", (message) => { // serialize console logs
        if (message.type == "log") {
            process.stdout.write(`${prefix}${message.data}`);
        } else if (message.type == "stm") {
            stm.handle(worker, message);
        } else {
            process.stdout.write(`${prefix}unsupported message: ${JSON.stringify(message)}\n`);
        }
    });
}

function displayBanner(out) {
    function charConvert(input) {
        let base = 0x2070;
        if(input === "2" || input === "3") {
            base = 0x00B0;
        } else if(input === ".") {
            return "\u00B7";
        }
        return String.fromCharCode(base + parseInt(input));
    }
    const banner = fs.readFileSync(path.resolve(__dirname, "root", "banner"))
    .toString()
    .replace("${version}", version.replace(/[0-9.]/g, charConvert));
    
    out.write(`${color.yellow.bold}${banner}${color.reset}\n`);
}

if (cluster.isMaster) {

    displayBanner(process.stdout);
    const numCPUs = require("os").cpus().length;

    cluster.on("exit", function (worker, code, signal) {
        process.stdout.write(`main: Worker ${worker.id} died with exit code ${code} (${signal})\n`);
        queue.clean(worker.id);
        startWorker();
    });

    for (let i = 0; i < numCPUs; i++) {
        startWorker();
    }
} else {
    require("./shield")();
}