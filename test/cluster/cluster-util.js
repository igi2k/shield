module.exports = {
    execute: execute
};

const master = require("path").resolve(__dirname, "./master");

function execute([workerPath, writes, useRetryFn], cwd) {
    const childProcess = require("child_process");
    return new Promise((resolve, reject) => {
        let result;                
        const child = childProcess.fork(master, [workerPath, writes, useRetryFn], { execArgv: [], cwd: cwd });
        child.on("message", (data) => {
            result = data;
        });
        child.on("exit", (code) => {
            if (code === 0) {
                resolve(result);
            } else {
                reject(new Error(code));
            }
        });
    });
}
