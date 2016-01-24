// =========================================================================
// passport activedirectory strategy =======================================
// =========================================================================
// reference: https://scotch.io/tutorials/easy-node-authentication-setup-and-local#handling-signup/registration

var LocalStrategy   = require('passport-local').Strategy;

// expose this function to our app using module.exports
module.exports = function(passport) {

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

    passport.use('dummy', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with username
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) { // callback with username and password from our form
        // creating a request through activedirectory by ldap
        // try to bring user-input in a form which is accepted by the server

        // all is well, return successful user
        return done(null, username);
    }));
};
