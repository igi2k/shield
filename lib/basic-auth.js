module.exports = function BasicAuthHandlerFactory(authService) {
    /**
     * Uses browser basic user authentication scheme
     */
    return function BasicAuthHandler(req, res, next) {
        var auth = req.headers.authorization;
        if (!auth) {
            unauthorized(res);
        } else {
            var credentials = getCredentials(auth);
            var token = authService.authenticate(credentials);
            if(token){
                res.locals.token = authService.verify(token);
                res.cookie("token", token, { httpOnly: false });
                next();
            } else {
                unauthorized(res);
            }
        }
    };
};

function unauthorized(response){
    response.setHeader('WWW-Authenticate', 'Basic realm="Shield"');
    response.status(401).render('401', { title: 401 });
}

function decodeBase64(str) {
  return new Buffer(str, 'base64').toString();
}

function Credentials(user, password) {
  this.user = user;
  this.password = password;
}

var credentialsRegExp = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9\-\._~\+\/]+=*) *$/;
var userPassRegExp = /^([^:]*):(.*)$/;

function getCredentials(auth) {
        
    var match = credentialsRegExp.exec(auth);
    if(!match){
        return;
    }

    // decode user pass
    var userPass = userPassRegExp.exec(decodeBase64(match[1]));

    if (!userPass) {
        return;
    }
    return new Credentials(userPass[1], userPass[2]);
}
