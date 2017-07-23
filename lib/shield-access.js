module.exports = function ShieldAccessFactory(requiredRole, setHtmlBaseUrl) {

    return function ShieldAccess(req, res, next) {
        const auth = res.locals.auth;
        if (auth && auth.hasRole(requiredRole)) {
            return next();
        }
        req.baseUrl = ""; //TODO: this should fall to generic handler
        setHtmlBaseUrl(req, res);
        res.status(403).render("403", { title: "403" });
    };
};