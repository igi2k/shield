/**
 * Created with IntelliJ IDEA.
 * User: IGI2k
 * Date: 06/08/2014
 */
var cluster = require("cluster");
var winston = require('winston');
var colors = require('colors');
var path = require('path');
var fs = require('fs');

function startWorker(){
    var worker = cluster.fork();
    var prefix = worker.id + ": ";
    
    worker.on("message", function(message){ // serialize console logs
        
        if(message.type == 'log'){
            process.stdout.write(prefix + message.data);
        } else {
            winston.error("unsupported message: %s", JSON.stringify(message));
        }
    });
}

function displayBanner(out){
    var banner = fs.readFileSync(path.resolve(__dirname, "root", "banner")).toString(); 
    out.write(banner.yellow.bold + "\n");
}

if(cluster.isMaster){

    displayBanner(process.stdout);
    var numCPUs = require('os').cpus().length / 2;

    for (var i = 0; i < numCPUs; i++) {
        startWorker();
    }

    cluster.on("exit", function(worker, code, signal){
        winston.log("main: Worker %d died with exit code %d (%s)", worker.id, code, signal);
        startWorker();
    });

} else {
    require("./shield")(cluster.worker.id);
}