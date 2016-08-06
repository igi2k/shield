const cluster = require("cluster");

module.exports = {
    region: function (name) {
        if(cluster.isMaster) {
            return new RegionPromise(name);
        }
        return new RegionProxy(name);
    },
    handle: handle
};

var _storage = Object.create(null);

const ReadAction = "read";
const WriteAction = "write";
const MessageType = "stm";

/**
 * @param {string} regionName
 * @returns {Region} region
 */
function getRegion(regionName) {
    return _storage[regionName] || (_storage[regionName] = new Region());
}

/**
 * Handle message from worker, designed to be called from main script
 */
function handle(worker, message) {
    if(cluster.isWorker) {
        throw new Error("Can't use from worker.");
    }
    var id = message.id;
    var data = message.data;
    var region = getRegion(data.region);
    var key = data.key;
    var action = data.action;
    if(action == ReadAction) {
        worker.send({
           type: MessageType, id: id, data: region.get(key, data.initialValue)
        });
    } else if (action == WriteAction) {
        var result = region.set(key, data.value);
        worker.send({
            type: MessageType, id: id, fail: !result.stored, data: result.item
        });
    }
}

function RegionPromise(name) {
    var region = getRegion(name);

    function cloneValue(value) {
        return value !== undefined && JSON.parse(JSON.stringify(value));
    }

    this.get = function (key, initialValue) {
        var item = region.get(key, cloneValue(initialValue));
        return Promise.resolve(cloneValue(item));
    };

    this.set = function (key, value) {
        var result = region.set(key, cloneValue(value));
        var item = cloneValue(result.item);
        return result.stored ? Promise.resolve(item) : Promise.reject(item);
    };
}

function RegionProxy(name) {
    this._name = name;
    var counter = 0;
    var requests = Object.create(null);

    this._send = function (data, handler) {
        var id = cluster.worker.id + String(counter++);  //TODO: id should be reused later otherwise we could hit overflow
        requests[id] = handler;
        process.send({
            type: MessageType,
            data: data,
            id: id
        });
    };

    process.on('message', function(message) { //TODO: this would be registered multiple times from different places
        if(message.type != MessageType) {
            return;
        }
        var handler = requests[message.id];
        if(!handler){
            return;
        }
        delete requests[message.id];
        handler(message);
    });
}
RegionProxy.prototype.get = function (key, initialValue) {
    var region = this._name;
    var send = this._send;
    return new Promise(function (resolve) {
        function handler(message) {
            resolve(message.data);
        }
        send({
            action: ReadAction,
            region: region,
            key: key,
            initialValue: initialValue
        }, handler);
    });
};
RegionProxy.prototype.set = function (key, value) {
    var region = this._name;
    var send = this._send;
    return new Promise(function (resolve, reject) {
        function handler(message) {
            if (!message.fail) {
                resolve(message.data);
            } else {
                reject(message.data);
            }
        }
        send({
            action: WriteAction,
            region: region,
            key: key,
            value: value
        }, handler);
    });
};

// expecting copy of value here
function StorageItem(value, version) {
    var result;
    if(value !== null && typeof value === "object" && !Array.isArray(value)) {
        result = value;
    } else {
        result = {
            value: value
        };
    }
    result.__v = version;
    return result;
}
function StorageItemVersion(item) {
    return item.__v;
}

function Region() {
    this.storage = Object.create(null);
}
Region.prototype.get = function (key, initialValue) {
    var storage = this.storage;
    var item = storage[key];
    if(!item && initialValue !== undefined) {
        item = storage[key] = StorageItem(initialValue, 0);
    }
    return item;
};
Region.prototype.set = function (key, value) {
    var storage = this.storage;
    var item = storage[key];
    // value is not stored yet
    if(!item) {
        return {
            stored: true,
            item: (storage[key] = StorageItem(value, 0))
        };
    }
    // value exists, need to compare versions
    var version = StorageItemVersion(item);
    var versionMatch = value && (version === StorageItemVersion(value));
    if(versionMatch) {
        item = storage[key] = StorageItem(value, version + 1); 
    }
    return {
        stored: versionMatch,
        item: item
    };
};