// =========================================================================
// passport activedirectory strategy =======================================
// =========================================================================
// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration

var LocalStrategy = require('passport-local').Strategy,
  ActiveDirectory = require('activedirectory');

// expose this function to our app using module.exports
module.exports = function(passport, config_ldap) {

  if (config_ldap == undefined || config_ldap.url == undefined || config_ldap.baseDN == undefined) {
    console.log("LDAP Auth Error: missing server informations in config");
    return;
  }
  // =========================================================================
  // passport session setup ==================================================
  // =========================================================================
  // required for persistent login sessions
  // used to serialize the user for the session
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  // used to deserialize the user
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  // =========================================================================
  // activedirectory LOGIN ===================================================
  // =========================================================================

  passport.use('activedirectory-login', new LocalStrategy({
      // by default, local strategy uses username and password, we will override with username
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) { // callback with username and password from our form
      // creating a request through activedirectory by ldap
      // try to bring user-input in a form which is accepted by the server

      if (config_ldap.url.indexOf('ldap:\\\\') != 0) {
        config_ldap.url = 'ldap:\\\\' + config_ldap.url;
      }
      var user = username.split("@")[0] + "@" + config_ldap.url.split('ldap:\\\\')[1];

      var cred = {
        url: config_ldap.url,
        baseDN: config_ldap.baseDN,
        username: user,
        password: password
      };

      // console.log(req.connection.remoteAddress);

      var ad = new ActiveDirectory(cred);
      ad.userExists(username, function(err, exists) {
        if (err) {
          // if error, return no user
          // console.log("Authentification Error", err.name);
          return;
        }
        // if user exists, then check, if user can authenticate
        else if (exists) {
          ad.authenticate(user, password, function(err, auth) {
            if (auth) {
              // all is well, return successful user
              return done(null, user);
            } else {
              // if password false, return no user
              return done(null, false);
            }
          });
        }
      });
    }));
};
