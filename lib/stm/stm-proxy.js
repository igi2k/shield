const ReadAction = "read";
const WriteAction = "write";
const CleanAction = "clean";
const ChangeAction = "change";

module.exports = {
    RegionProxy: RegionProxy,
    actions: {
        ReadAction, WriteAction, CleanAction, ChangeAction
    }
};

function RegionProxy(name, messaging) {
    this._name = name;
    this._send = messaging._send;
    this._callback = messaging._callback;
}

RegionProxy.prototype.get = function (key, options) {
    const region = this._name;
    const send = this._send;
    const initial = options ? options.value : undefined;
    return new Promise((resolve) => {
        send({
            action: ReadAction,
            region: region,
            key: key,
            initialValue: initial
        }, function handler(message) {
            resolve(message.data);
        });
    });
};

RegionProxy.prototype.set = function (key, value, options) {
    const region = this._name;
    const send = this._send;
    options = options || {};
    return new Promise((resolve, reject) => {
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
    const region = this._name;
    const send = this._send;
    return new Promise((resolve) => {
        send({
            action: CleanAction,
            region: region
        }, function handler(message) {
            resolve(message.data);
        });
    });
};

RegionProxy.prototype.notify = function (onChange) {
    const region = this._name;
    this._callback(`${ChangeAction}|${region}`, onChange);
    return Promise.resolve(!!onChange);
};