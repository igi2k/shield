const stmApi = require("../stm");

module.exports = class AntiHammering {
    
    constructor(key, threshold, cooldownTime) {
        this.stmRegion = stmApi.region(key);
        this.threshold = threshold;
        this.cooldownTime = cooldownTime;
    }

    check(ip, result) {

        const fail = result instanceof Error;
        const threshold = this.threshold;
        const cooldownTime = this.cooldownTime;

        const processEntry = (entry) => {
            const timestamp = Date.now();
            let hammering = false;
            
            if (timestamp - entry.timestamp < threshold.timestamp) {
                if (fail) { // update when user supplied wrong credentials
                    entry.count += 1;
                }
                hammering = entry.count > threshold.count;
            } else {
                entry.count = 1;
            }
            
            entry.timestamp = timestamp;
            
            return this.stmRegion.set(ip, entry)
            .then(() => {
                return hammering;
            }, processEntry); // stm retry
        };

        return new Promise((resolve, reject) => {

            const passResult = () => {
                if (fail) {
                    return reject(result);
                }
                resolve(result);
            };

            this.stmRegion.get(ip, { value: { count: 0, timestamp: Date.now() }})
            .then(processEntry)
            .then((hammering) => {
                setTimeout(passResult, hammering ? cooldownTime : 0);
            })
            .catch(passResult); // case when there is something wrong
        });
    }

    clear(ip) {
        const processEntry = (entry) => {
            entry.count = 0;
            return this.stmRegion.set(ip, entry)
            .catch(processEntry);
        };
        this.stmRegion.get(ip, { value: { count: 0, timestamp: Date.now() }})
        .then(processEntry);
    }

};