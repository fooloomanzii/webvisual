// =========================================================================
// passport activedirectory strategy =======================================
// =========================================================================
// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration

var LocalStrategy   = require('passport-local').Strategy,
    ActiveDirectory = require('activedirectory');

// expose this function to our app using module.exports
module.exports = function(passport, config) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    // used to deserialize the user
    passport.deserializeUser(function(user, done){
        done(null, user);
    });

    // =========================================================================
    // activedirectory LOGIN ===================================================
    // =========================================================================

    passport.use('activedirectory-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with username
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) { // callback with username and password from our form
        // creating a request through activedirectory by ldap
        // try to bring user-input in a form which is accepted by the server
        if (config.ldap.url.indexOf('ldap:\\\\') != 0) {
          config.ldap.url = 'ldap:\\\\' + config.ldap.url;
        }
        var user = username.split("@")[0] + "@" + config.ldap.url.split('ldap:\\\\')[1];

        var cred = { url: config.ldap.url,
                     baseDN: config.ldap.baseDN,
                     username: user,
                     password: password
                   };

        var ad = new ActiveDirectory(cred);
        ad.userExists(username, function(err, exists) {
          if (err) {
            // if error, return no user
            console.log("strat err: "+ JSON.stringify(err));
            return done(null, false);

          }
          // if user exists, then check, if user can authenticate
          if(exists) {
            ad.authenticate(user, password, function(err, auth) {
              if (auth) {
                // all is well, return successful user
                return done(null, user);
              }
              else {
                // if password false, return no user
                return done(null, false);
              }
            });
          }
        });
    }));
};
