
module.exports = {
    SERVICE, serviceMetadata
};

const metadata = Symbol("metadata");

function SERVICE(name) {
    let instance, dependencies = [];
    if (arguments.length === 3) {
        [, dependencies, instance] = arguments;
    } else {
        [, instance] = arguments;
    }
    if (instance instanceof Function) {
        const argumentCount = instance.length;
        if (argumentCount !== dependencies.length) {
            throw new Error(`Missing dependencies: ${name} [${dependencies}] expected: ${argumentCount}`);
        }
    }
    instance[metadata] = { name, dependencies };
    return instance;
}

function serviceMetadata(instance) {
    return instance[metadata];
}