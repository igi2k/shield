var cluster = require('cluster');
var stm = require('../lib/stm');

function startWorker() {
    var worker = cluster.fork();
    var prefix = worker.id + ": ";

    worker.on("message", function(message){ // serialize console logs
        if(message.type == 'log') {
            process.stdout.write(prefix + message.data);
        } else if(message.type == 'stm') {
            stm.handle(worker, message);
        } else {
            console.error("unsupported message: %s", JSON.stringify(message));
        }
    });
}

function workerTask(id) {
    var clientMap = stm.region("clientMap");
    var key = "test";

    function processEntry(entry){
        // console.log("%d-: %s", id, JSON.stringify(entry))
        entry.value++;
        return clientMap.set(key, entry).then(function(entry) {
            console.log("%d+: %s", id, JSON.stringify(entry));
        }, function(entry) { // stm error
            // console.log("%d retry: %s", id, JSON.stringify(entry));
            return processEntry(entry);
        });
    }

    setInterval(function () {
        clientMap.get(key, { value: 0 }).then(processEntry).catch(function(error) {
            console.error("%d: %s", id, error);
        });
    }, 1000);
    setInterval(function () {
        clientMap.get(key, { value: 0 }).then(processEntry).catch(function(error) {
            console.error("%d: %s", id, error);
        });
    }, 500);
    setInterval(function () {
        clientMap.get(key, { value: 0 }).then(processEntry).catch(function(error) {
            console.error("%d: %s", id, error);
        });
    }, 1000);
}

if(cluster.isMaster){

    var numCPUs = require('os').cpus().length;

    for (var i = 0; i < numCPUs; i++) {
        startWorker();
    }

    cluster.on("exit", function(worker, code, signal){
        console.error("main: Worker %d died with exit code %d (%s)", worker.id, code, signal);
    });

} else {
    workerTask(cluster.worker.id);
}