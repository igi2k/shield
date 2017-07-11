const cluster = require("cluster");
const Proxy = require("./stm/stm-proxy");
const RegionProxy = Proxy.RegionProxy;
const ProxyActions = Proxy.actions;
const RegionPromise = require("./stm/stm-promise").RegionPromise;
const Region = require("./stm/stm-region");

const MessageType = "stm";

module.exports = {
    region: function (name) {
        if (cluster.isMaster) {
            return new RegionPromise(Region.getRegion(name));
        }
        if (!_proxyMessaging) {
            _proxyMessaging = new ProxyMessaging();
        }
        return new RegionProxy(name, _proxyMessaging);
    }
};

if(cluster.isWorker) {
    return;
}

module.exports.handle = handle;
module.exports.clean = clean;

function clean(regionCallback) {
    Region.getAllRegions().forEach((region) => {
        regionCallback({
            clean: function (callback) {
                const key = region.name;
                if (region.clean(callback)) {
                    notifyDispatch(key);
                }
            }
        });
    });
}

var _proxyMessaging = null;

function notifyDispatch(regionName, storageItem, sourceWorker) {
    const workers = cluster.workers;
    for (var key in workers) {
        var dispatch = workers[key];
        if (dispatch !== sourceWorker && dispatch.isConnected()) {
            dispatch.send({
                type: MessageType,
                id: `${ProxyActions.ChangeAction}|${regionName}`,
                data: storageItem || true
            });
        }
    }
}

/**
 * Handle message from worker, designed to be called from main script
 */
function handle(worker, message) {
    var id = message.id;
    var data = message.data;
    var region = Region.getRegion(data.region);
    var key = data.key;
    var action = data.action;
    var notify = data.notify;
    if (action === ProxyActions.ReadAction) {
        worker.send({
            type: MessageType, id: id, data: region.get(key, data.initialValue)
        });
    } else if (action === ProxyActions.WriteAction) {
        var retryModule = data.retry;
        var retryFn = retryModule && require.main.require(retryModule);
        var result = region.set(key, data.value, retryFn);
        worker.send({
            type: MessageType, id: id, fail: !result.stored, data: result.item
        });
        if (notify && result.stored) {
            notifyDispatch(data.region, result.item, worker);
        }
    } else if (action === ProxyActions.CleanAction) {
        worker.send({
            type: MessageType, id: id, data: region.clean()
        });
    }
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