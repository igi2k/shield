module.exports = function LocalUsersFactory(app) {

    return async function getUser(username, trusted) {
        const users = app.locals.users;
        const user = users[username] || ( trusted && { roles: [] } );
        if (!user) {
            throw new Error(`Unknown user [${username}]`);
        }
        return user;
    };

};