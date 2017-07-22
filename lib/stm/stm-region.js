module.exports = {
    getRegion: getRegion,
    getAllRegions: getAllRegions
};

let _storage = Object.create(null);

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
    let result;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result = value;
    } else {
        result = { value };
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
        const storage = this.storage;
        let item = storage[key];
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
        const storage = this.storage;
        let item = storage[key];
        // value is not stored yet
        if (!item) {
            return {
                stored: true,
                item: (storage[key] = StorageItem(value, 0))
            };
        }
        // value exists, need to compare versions
        const version = StorageItemVersion(item);
        let versionMatch = value && (version === StorageItemVersion(value));
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

    clean(updateCallback) {
        let result = false;
        if (typeof updateCallback === "function") {
            const storage = this.storage;
            for (let key in storage) {
                const item = storage[key];
                const changed = updateCallback(key, item);
                if (changed) {
                    storage[key] = StorageItem(item, StorageItemVersion(item) + 1);
                }
                result |= changed;
            }
        } else { // clean all
            this.storage = Object.create(null);
            result = true;
        }
        return result;
    }
}