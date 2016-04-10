module.exports = function BasicAuthHandlerFactory(authService) {
    /**
     * Uses browser basic user authentication scheme
     */
    return function BasicAuthHandler(req, res, next) {
        var authHeader = req.headers.authorization;
        if (!authHeader) {
            unauthorized(req, res);
        } else {
            var credentials = getCredentials(authHeader);
            var token = authService.authenticate(credentials, req.ip);
            if(token){
                var auth = res.locals.auth = authService.verify(token, req.ip);
                res.cookie("token", token, { 
                    httpOnly: false,
                    secure: true,
                    expires: new Date(auth.exp * 1000)
                });
                next();
            } else {
                unauthorized(req, res);
            }
        }
    };
};

function unauthorized(req, res){
    if(!req.secure){
        throw new Error("Non encrypted connection.");
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Shield"');
    res.status(401).render('401', { title: "401" });
}

function Credentials(user, password) {
  this.user = user;
  this.password = password;
}

function decodeBase64(str) {
  return new Buffer(str, 'base64').toString();
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
