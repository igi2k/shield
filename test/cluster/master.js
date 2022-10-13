const cluster = require("cluster");
const stm = require("../../lib/stm");

function ok(result) {
    process.send({ type: "result", result: result });
}
function fail(error) {
    process.send({
        type: "result", result: {
            id: cluster.worker.id,
            error: error.message
        }
    });
}
if (!cluster.isMaster) {
    const workerTask = require(process.argv[2]);
    const writes = +process.argv[3];
    const useRetryFn = process.argv[4] === "true";
    workerTask(cluster.worker.id, writes, useRetryFn).then(ok, fail).then(function () {
        process.disconnect();
    });
    return;
}

// CONFIGURE MASTER

require.main.paths.push(require("path").resolve(".")); // fix project based resolve
var numCPUs = require("os").cpus().length;

var result = [];
var total = process.argv[3];

var writesPerTask = Math.ceil(total / numCPUs);

function startWorker() {
    var writes = writesPerTask;
    if (total < writesPerTask) {
        writes = total;
    }
    total -= writesPerTask;
    cluster.setupMaster({
        args: [process.argv[2], writes, process.argv[4]]
    });
    var worker = cluster.fork();

    worker.on("message", function (message) {
        if (message.type === "result") {
            result.push(message.result);
        } else if (message.type === "stm") {
            stm.handle(worker, message);
        } else {
            console.error("unsupported message: %s", JSON.stringify(message));
        }
    });
}

var finished = 0;
cluster.on("exit", function (worker, code, signal) {
    if (code !== 0) {
        console.error("main: Worker %d died with exit code %d (%s)", worker.id, code, signal);
    }
    if (++finished === numCPUs) {
        process.send(result);
    }
});

for (var i = 0; i < numCPUs; i++) {
    startWorker();
}