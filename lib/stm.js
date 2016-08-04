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

var _storage = {};

const ReadAction = "read";
const WriteAction = "write";
const MessageType = "stm";

function getRegion(regionName) {
    if(!_storage.hasOwnProperty(regionName)){
        return (_storage[regionName] = new Region());
    }
    return _storage[regionName];
}

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
            type: MessageType, id: id, fail: !result.saved, data: result.item
        });
    }
}

function RegionPromise(name) {
    var region = getRegion(name);

    this.get = function (key, initialValue) {
        return Promise.resolve(region.get(key, initialValue))
    };

    this.set = function (key, value) {
        var result = region.set(key, value);
        return result.saved ? Promise.resolve(result.item) : Promise.reject(result.item);
    };
}

function RegionProxy(name) {
    this._name = name;
    var counter = 0;
    var requests = {};

    this._send = function (data, handler) {
        var id = cluster.worker.id + String(counter++);  //TODO: id should be reused later otherwise we could hit overflow
        requests[id] = handler;
        process.send({
            type: MessageType,
            data: data,
            id: id
        })
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
    })
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

function Region() {
    this.storage = {};
}
Region.prototype.get = function (key, initialValue) {
    var storage = this.storage;
    if(!storage.hasOwnProperty(key)) {
        initialValue.__v = 0; // expecting copy here
        return storage[key] = initialValue;
    }
    return storage[key];
};
Region.prototype.set = function (key, value) {
    var storage = this.storage;
    if(!storage.hasOwnProperty(key)) {
        return this.get(key, value)
    }
    // value exists, need to compare versions
    var item = storage[key];
    var saved = item.__v === value.__v;
    if(saved) {
        item = storage[key] = value; //expecting copy here
        item.__v++;
    }
    return {
        saved: saved,
        item: item
    };
};