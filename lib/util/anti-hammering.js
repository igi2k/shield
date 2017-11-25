const stmApi = require("../stm");

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = class AntiHammering {
    
    constructor(key, threshold, cooldownTime) {
        this.stm = stmApi.region(key);
        this.threshold = threshold;
        this.cooldownTime = cooldownTime;
    }

    async check(ip, result) {

        const fail = result instanceof Error;
        const threshold = this.threshold;
        const cooldownTime = this.cooldownTime;

        try {
            const entry = await this.stm.update(ip, (entry) => {
                const timestamp = Date.now();
                if (timestamp - entry.timestamp < threshold.timestamp) {
                    if (fail) { // update when user supplied wrong credentials
                        entry.count += 1;
                    }
                } else {
                    entry.count = 1;
                }
                entry.timestamp = timestamp;
            }, {
                value: { count: 0, timestamp: Date.now() }
            });

            const hammering = entry.count > threshold.count;
            await timeout(hammering ? cooldownTime : 0);
        } catch (_) {
            // in case of there is something wrong
        }
        if(fail) {
            throw result;
        }
        return result;
    }

    async clear(ip) {
        await this.stm.update(ip, (entry) => {
            entry.count = 0;
        }, { 
            value: { count: 0, timestamp: Date.now() }
        });
    }
};