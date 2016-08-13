var colors = {
    reset: 0,
    bold: 1,
    dark: 2,
    inverted: 7,
    green: 32,
    red: 31,
    yellow: 33,
    darkGray: 90,
    cyan: 36,
};
colors.default = colors.darkGray;

function escape(value) {
    return `\x1b[${value}m`;
}
function Color(array) {
    function createProperty(color) {
        return function () {
            return new Color(array.concat(color));
        };
    }
    for (var key in colors) {
        Object.defineProperty(this, key, {
            get: createProperty(colors[key])
        });
    }
    this.toString = function () {
        return array.map(escape).join("");
    };
}

module.exports = new Color([]);