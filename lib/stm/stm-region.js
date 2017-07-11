module.exports = {
    getRegion: getRegion,
    getAllRegions: getAllRegions
};

var _storage = Object.create(null);

function getAllRegions() {
    return Object.keys(_storage).map(getRegion);
}

/**
 * @param {string} regionName
 * @returns {Region} region
 */
function getRegion(regionName) {
    return _storage[regionName] || (_storage[regionName] = new Region(regionName));
}

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

class Region {

    constructor(name) {
        this.name = name;
        this.storage = Object.create(null);
    }
    
    get(key, initialValue) {
        var storage = this.storage;
        var item = storage[key];
        if (!item && initialValue !== undefined) {
            item = storage[key] = StorageItem(initialValue, 0);
        }
        return item;
    }

    /**
     * Store value in map
     * @param {string} key
     * @param {Object} value
     * @param {function} [retryFn]
     */
    set(key, value, retryFn) {
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
    }

    clean(callback) {
        let result = false;
        if (typeof callback === "function") {
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
    }
}