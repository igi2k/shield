module.exports = {
    RegionPromise: RegionPromise
};

function RegionPromise(region) {

    function cloneValue(value) {
        return value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;
    }

    this.get = (key, options) => {
        const initial = options ? options.value : undefined;
        const item = region.get(key, cloneValue(initial));
        return Promise.resolve(cloneValue(item));
    };

    this.set = (key, value, options) => {
        const retryModule = options && options.retryModule;
        const retryFn = retryModule && require.main.require(retryModule);
        const result = region.set(key, cloneValue(value), retryFn);
        const item = cloneValue(result.item);
        return result.stored ? Promise.resolve(item) : Promise.reject(item);
    };

    this.clean = () => {
        return Promise.resolve(region.clean());
    };

    this.notify = (onChange) => {
        return Promise.resolve(!!onChange);
    };
}
