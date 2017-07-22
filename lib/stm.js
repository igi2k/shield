const cluster = require("cluster");
const Proxy = require("./stm/stm-proxy");
const RegionProxy = Proxy.RegionProxy;
const ProxyActions = Proxy.actions;
const RegionPromise = require("./stm/stm-promise").RegionPromise;
const Region = require("./stm/stm-region");

const MessageType = "stm";
let _proxyMessaging = null;

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
            clean: function (updateCallback) {
                const key = region.name;
                if (region.clean(updateCallback)) {
                    notifyDispatch(key);
                }
            }
        });
    });
}

function notifyDispatch(regionName, storageItem, sourceWorker) {
    const workers = cluster.workers;
    for (let key in workers) {
        const dispatch = workers[key];
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
    const id = message.id;
    const data = message.data;
    const region = Region.getRegion(data.region);
    const key = data.key;
    const action = data.action;
    const notify = data.notify;
    if (action === ProxyActions.ReadAction) {
        worker.send({
            type: MessageType, id: id, data: region.get(key, data.initialValue)
        });
    } else if (action === ProxyActions.WriteAction) {
        const retryModule = data.retry;
        const retryFn = retryModule && require.main.require(retryModule);
        const result = region.set(key, data.value, retryFn);
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

    let requests = Object.create(null);
    let callbacks = Object.create(null);
    let counter = 0;

    this._send = function (data, handler) {
        const id = cluster.worker.id + String(counter++);  //TODO: id should be reused later otherwise we could hit overflow
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
        const callback = callbacks[message.id];
        if (callback) {
            return callback(message.data);
        }
        const handler = requests[message.id];
        if (handler) {
            delete requests[message.id];
            handler(message);
        }
    });
}