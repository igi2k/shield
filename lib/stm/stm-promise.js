module.exports = {
    RegionPromise: RegionPromise
};

function RegionPromise(region) {

    function cloneValue(value) {
        return value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;
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
