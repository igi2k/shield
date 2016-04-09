var request = require("request");

module.exports = function ShieldProxyFactory(targetUrl) {
        
    return function ShieldProxy(req, res, next){    
        var url = targetUrl + req.url;
        //TODO: add an extra app info to the error?
        req.pipe(request(url).on("error", next)).pipe(res);
    };    
};
