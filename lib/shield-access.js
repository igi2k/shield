module.exports = function ShieldAccessFactory(requiredRole) {

    return function ShieldAccess(req, res, next) {
        var auth = res.locals.auth;
        if (auth && auth.hasRole(requiredRole)) {
            return next();
        }
        res.status(403).render("403", { title: "403" });
    };
};