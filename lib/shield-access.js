module.exports = function ShieldAccessFactory(requiredRole, ShieldError) {

    return function ShieldAccess(req, res, next) {
        const auth = res.locals.auth;
        if (auth && auth.hasRole(requiredRole)) {
            return next();
        }
        res.status(403);
        return next(new ShieldError("403", { title: "403" }));
    };
};