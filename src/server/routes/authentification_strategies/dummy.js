
// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration
const passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy;

// expose this function to our app using module.exports
module.exports = function() {
    // required for persistent login sessions
    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    // used to deserialize the user
    passport.deserializeUser(function(user, done){
        done(null, user);
    });

    passport.use('dummy', new LocalStrategy({
          usernameField : 'username',
          passwordField : 'password',
          passReqToCallback : true
      }, function(req, username, password, done) {
          return done(null, username);
      }));
};
