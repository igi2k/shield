module.exports = function ShieldAccessFactory(requiredRole) {

    return function ShieldAccess(req, res, next) {
        if (hasRole(res.locals, requiredRole)) {
            return next();
        }
        res.status(403).render("403", { title: "403" });
    };
};

function hasRole(locals, role) {
    var auth = locals.auth || {};
    var roles = auth.roles;
    return roles && roles.indexOf(role) >= 0;
}

module.exports.hasRole = hasRole;