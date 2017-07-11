const request = require("request");

module.exports = function ShieldProxyFactory(targetUrl) {
        
    return function ShieldProxy(req, res, next){    
        const url = targetUrl + req.url;
        //TODO: add an extra app info to the error?
        req.pipe(request(url).on("error", next)).pipe(res);
    };    
};
