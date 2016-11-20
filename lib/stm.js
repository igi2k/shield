const cluster = require("cluster");

module.exports = {
    region: function (name) {
        if (cluster.isMaster) {
            return new RegionPromise(name);
        }
        if (!_proxyMessaging) {
            _proxyMessaging = new ProxyMessaging();
        }
        return new RegionProxy(name, _proxyMessaging);
    },
    handle: handle,
    clean: clean,
};

var _storage = Object.create(null);
var _proxyMessaging = null;

const ReadAction = "read";
const WriteAction = "write";
const CleanAction = "clean";
const ChangeAction = "change";
const MessageType = "stm";

function notifyDispatch(regionName, storageItem, sourceWorker) {
    const workers = cluster.workers;
    for (var key in workers) {
        var dispatch = workers[key];
        if (dispatch !== sourceWorker && dispatch.isConnected()) {
            dispatch.send({
                type: MessageType,
                id: `${ChangeAction}|${regionName}`,
                data: storageItem || true
            });
        }
    }
}

/**
 * @param {string} regionName
 * @returns {Region} region
 */
function getRegion(regionName) {
    return _storage[regionName] || (_storage[regionName] = new Region());
}

function clean(regionCallback) {
    if (cluster.isWorker) {
        throw new Error("Can't use from worker.");
    }
    for (var key in _storage) {
        var region = getRegion(key);
        regionCallback({
            clean: function (callback) {
                if (region.clean(callback)) {
                    notifyDispatch(key);
                }
            }
        });
    }
}
/**
 * Handle message from worker, designed to be called from main script
 */
function handle(worker, message) {
    if (cluster.isWorker) {
        throw new Error("Can't use from worker.");
    }
    var id = message.id;
    var data = message.data;
    var region = getRegion(data.region);
    var key = data.key;
    var action = data.action;
    var notify = data.notify;
    if (action == ReadAction) {
        worker.send({
            type: MessageType, id: id, data: region.get(key, data.initialValue)
        });
    } else if (action == WriteAction) {
        var retryModule = data.retry;
        var retryFn = retryModule && require.main.require(retryModule);
        var result = region.set(key, data.value, retryFn);
        worker.send({
            type: MessageType, id: id, fail: !result.stored, data: result.item
        });
        if (notify && result.stored) {
            notifyDispatch(data.region, result.item, worker);
        }
    } else if (action == CleanAction) {
        worker.send({
            type: MessageType, id: id, data: region.clean()
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

    this.set = function (key, value, options) {
        var retryModule = options && options.retryModule;
        var retryFn = retryModule && require.main.require(retryModule);
        var result = region.set(key, cloneValue(value), retryFn);
        var item = cloneValue(result.item);
        return result.stored ? Promise.resolve(item) : Promise.reject(item);
    };

    this.clean = function () {
        return Promise.resolve(region.clean());
    };

    this.notify = function (onChange) {
        return Promise.resolve(!!onChange);
    };
}

function ProxyMessaging() {

    var requests = Object.create(null);
    var callbacks = Object.create(null);
    var counter = 0;

    this._send = function (data, handler) {
        var id = cluster.worker.id + String(counter++);  //TODO: id should be reused later otherwise we could hit overflow
        requests[id] = handler;
        process.send({
            type: MessageType,
            data: data,
            id: id
        });
    };

    this._callback = function (id, callback) {
        callbacks[id] = callback;
    };

    process.on("message", function (message) {
        if (message.type != MessageType) {
            return;
        }
        var callback = callbacks[message.id];
        if (callback) {
            return callback(message.data);
        }
        var handler = requests[message.id];
        if (handler) {
            delete requests[message.id];
            handler(message);
        }
    });
}

function RegionProxy(name, messaging) {
    this._name = name;
    this._send = messaging._send;
    this._callback = messaging._callback;
}
RegionProxy.prototype.get = function (key, initialValue) {
    var region = this._name;
    var send = this._send;
    return new Promise(function (resolve) {
        send({
            action: ReadAction,
            region: region,
            key: key,
            initialValue: initialValue
        }, function handler(message) {
            resolve(message.data);
        });
    });
};

RegionProxy.prototype.set = function (key, value, options) {
    var region = this._name;
    var send = this._send;
    options = options || {};
    return new Promise(function (resolve, reject) {
        send({
            action: WriteAction,
            region: region,
            key: key,
            value: value,
            notify: !!options.notify,
            retry: options.retryModule
        }, function handler(message) {
            if (!message.fail) {
                resolve(message.data);
            } else {
                reject(message.data);
            }
        });
    });
};
RegionProxy.prototype.clean = function () {
    var region = this._name;
    var send = this._send;
    return new Promise(function (resolve) {
        send({
            action: CleanAction,
            region: region
        }, function handler(message) {
            resolve(message.data);
        });
    });
};

RegionProxy.prototype.notify = function (onChange) {
    var region = this._name;
    this._callback(`${ChangeAction}|${region}`, onChange);
    return Promise.resolve(!!onChange);
};

// expecting copy of value here
function StorageItem(value, version) {
    var result;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
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
    if (!item && initialValue !== undefined) {
        item = storage[key] = StorageItem(initialValue, 0);
    }
    return item;
};

/**
 * Store value in map
 * @param {string} key
 * @param {Object} value
 * @param {function} [retryFn]
 */
Region.prototype.set = function (key, value, retryFn) {
    var storage = this.storage;
    var item = storage[key];
    // value is not stored yet
    if (!item) {
        return {
            stored: true,
            item: (storage[key] = StorageItem(value, 0))
        };
    }
    // value exists, need to compare versions
    var version = StorageItemVersion(item);
    var versionMatch = value && (version === StorageItemVersion(value));
    if (versionMatch) {
        item = storage[key] = StorageItem(value, version + 1);
    } else if (retryFn) {
        item = storage[key] = StorageItem(retryFn(item), version + 1);
        versionMatch = true;
    }
    return {
        stored: versionMatch,
        item: item
    };
};
Region.prototype.clean = function (callback) {
    var result = false;
    if (typeof callback == "function") {
        var storage = this.storage;
        for (var key in storage) {
            var item = storage[key];
            var changed = callback(key, item);
            if (changed) {
                storage[key] = StorageItem(item, StorageItemVersion(item) + 1);
            }
            result |= changed;
        }
    } else {
        this.storage = Object.create(null);
        result = true;
    }
    return result;
};