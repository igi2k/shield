const stm = require("./stm");
const cluster = require("cluster");

module.exports = {
    region: function (name) {
        return RegionWrapper(stm.region(name));
    }
};

let counter = 0;
let notificatons = Object.create(null);

function RegionWrapper(region) {

    // called when region is updated
    // when worker exits
    function refreshAll() {
        const keys = Object.keys(notificatons).map((id) => {
            return notificatons[id].key; // gather all pending keys in region
        });
        Promise.all(keys.map((key) => {
            return region.get(key, {
                value: {
                    queue: [],
                    isQueue: true
                }
            });
        }))
        .then((results) => {
            results.forEach(onChange);
        });
    }

    function onChange(entry) {
        if (entry === true) { // multiple enties could be updated
            return refreshAll();
        }
        const id = entry.queue[0];
        let notificaton = notificatons[id];
        if (notificaton) {
            delete notificatons[id];
            notificaton.resolve();
        }
    }

    async function clearLock(key, id) {
        const entry = await region.update(key, (entry) => {
            // remove first item
            if (id === entry.queue[0]) {
                entry.queue.shift();
            }
        }, {
            value: { queue: [] },
            notify: true
        });
        return onChange(entry);
    }

    function lock(key, id, callback) {
        return Promise.resolve(id)
        .then(callback)
        .then((result) => {
            return clearLock(key, id).then(() => {
                return result;
            });
        }, (error) => {
            return clearLock(key, id).then(() => {
                return Promise.reject(error);
            });
        });
    }

    function queue(key, id, callback) {
        // we're queued, register notificaton
        return new Promise((resolve) => {
            notificatons[id] = {
                resolve: function () {
                    resolve(lock(key, id, callback));
                }, key
            };
        });
    }

    async function dispatchQueue(key, callback) {
        const id = `${(cluster.worker || { id: "main" }).id}|${counter++}`;
        const queued = queue(key, id, callback);
        
        const entry = await region.update(key, (entry) => {
            entry.queue.push(id);
        }, {
            value: {
                queue: [],
                isQueue: true
            }
        });
        // check queue
        if (id === entry.queue[0]) {
            onChange(entry);
        }
        return queued;        
    }

    const config = region.notify(onChange);

    return {
        async: function (key, callback) {
            return config.then(() => {
                return dispatchQueue(key, callback);
            });
        }
    };
}

if (cluster.isWorker) {
    return;
}
module.exports.clean = clean;

function clean(workerId) {
    stm.clean((region) => {
        region.clean((key, value) => {
            // trying to clean scheduled tasks in queue for specific worker
            const queue = value.queue;
            if(!value.isQueue || !Array.isArray(queue)) {
                return false;
            }
            const count = queue.length;
            value.queue = queue.filter((item) => {
                return !item.startsWith(`${workerId}|`);
            });
            return value.queue.length !== count;
        });
    });
}