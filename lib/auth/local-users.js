module.exports = function LocalUsersFactory(app) {

    return async function getUser(username) {
        const users = app.locals.users;
        const user = users[username];
        if (!user) {
            throw new Error(`Unknown user [${username}]`);
        }
        return user;
    };

};