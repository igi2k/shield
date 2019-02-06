const { serviceMetadata } = require("./util/service-registry");

module.exports = function ServicesFactory(app, setup) {
    
    function Resolver(factories) {
        const instances = {};
        const resolve = (name, _config) => {
            if(instances.hasOwnProperty(name)) {
                return instances[name];
            }
            //TODO: handle special dependencies
            if(name === ".app") {
                return app;
            }
            if(name === ".config") {
                return _config;
            }

            const { factory, dependencies, config } = factories[name];
            const parameters = dependencies.map((name) => resolve(name, config));
            
            return instances[name] = factory.apply(null, parameters);
        };
        return resolve;
    }

    const factories = setup.reduce((cache, [factory, config]) => {
        const { name, dependencies } = serviceMetadata(factory);
        cache[name] = { dependencies, factory, config };
        return cache;
    }, {});

    const resolve = Resolver(factories);

    const services = Object.keys(factories).map((name) => {
        return [ name,  resolve(name)];
    }).reduce((services, [name, instance])=> {
        services[name] = instance;
        return services;
    }, {});
    
    return services;
};

