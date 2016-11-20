const stm = require("./stm");
const cluster = require("cluster");

module.exports = {
    region: function (name) {
        return RegionWrapper(stm.region(name));
    }
};

if (cluster.isMaster) {
    // crash handler
    // TODO: clean only regions used by this module
    cluster.on("exit", function (worker, code) {
        if (code == 0) {
            return;
        }
        var id = worker.id;
        stm.clean(function (region) {
            region.clean(function (key, value) {
                var queue = value.queue;
                if (!Array.isArray(queue)) {
                    return false;
                }
                var count = queue.length;
                value.queue = queue.filter(function (item) {
                    return !item.startsWith(`${id}|`);
                });
                return value.queue.length !== count;
            });
        });
    });
}

var counter = 0;
var notificatons = Object.create(null);

function RegionWrapper(region) {

    function refreshAll() {
        var keys = Object.keys(notificatons).map(function (id) {
            return notificatons[id].key;
        });
        Promise.all(keys.map(function (key) {
            return region.get(key, { queue: [] });
        })).then(function (results) {
            results.forEach(function (entry) {
                onChange(entry);
            });
        });
    }

    function onChange(entry) {
        if (entry === true) { // cleaned data
            return refreshAll();
        }
        var id = entry.queue[0];
        var notificaton = notificatons[id];
        if (notificaton) {
            delete notificatons[id];
            notificaton.resolve();
        }
    }

    var config = region.notify(onChange);

    function clearLock(key, id) {
        return region.get(key, { queue: [] }).then(function retry(entry) {
            // remove first item
            if (id === entry.queue[0]) {
                entry.queue.shift();
            }
            // save queue
            return region.set(key, entry, { notify: true }).catch(retry);
        }).then(onChange);
    }

    function lock(key, id, callback) {
        return Promise.resolve(id)
            .then(callback)
            .then(function (result) {
                return clearLock(key, id).then(function () {
                    return result;
                });
            }, function (error) {
                return clearLock(key, id).then(function () {
                    return Promise.reject(error);
                });
            });
    }

    function queue(key, id, callback) {
        // we're queued, register notificaton
        return new Promise(function (resolve) {
            notificatons[id] = {
                resolve: function () {
                    resolve(lock(key, id, callback));
                }, key
            };
        });
    }

    function dispatchQueue(key, callback) {
        var id = `${cluster.worker.id}|${counter++}`;
        var queued = queue(key, id, callback);
        return region.get(key, {
            queue: []
        }).then(function retry(entry) {
            entry.queue.push(id);
            // save queue
            return region.set(key, entry).catch(retry);
        }).then(function (entry) {
            // check queue
            if (id === entry.queue[0]) {
                onChange(entry);
            }
            return queued;
        });
    }

    return {
        async: function (key, callback) {
            return config.then(function () {
                return dispatchQueue(key, callback);
            });
        }
    };
}