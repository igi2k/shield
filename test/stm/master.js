const cluster = require('cluster');
const stm = require('../../lib/stm');
const workerTask = require('./worker');

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
    var writes = process.argv[2];
    workerTask(cluster.worker.id, writes).then(ok, fail).then(function () {
        process.disconnect();
    });
    return;
}

var numCPUs = require('os').cpus().length;

var result = [];
var total = process.argv[2];
var writesPerTask = Math.round(total / numCPUs);

function startWorker() {
    var writes = writesPerTask;
    if (total < writesPerTask) {
        writes = total;
    }
    total -= writesPerTask;
    cluster.setupMaster({
        args: [writes],
    });
    var worker = cluster.fork();
    var prefix = worker.id + ": ";

    worker.on("message", function (message) {
        if (message.type == 'result') {
            result.push(message.result);
        } else if (message.type == 'stm') {
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
    if (++finished == numCPUs) {
        process.send(result);
    }
});

for (var i = 0; i < numCPUs; i++) {
    startWorker();
}

