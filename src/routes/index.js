// Routing

module.exports = function(app, passport, config_auth) {

  require('./passport_strategies/activedirectory.js')(passport, config_auth.ldap); // register custom ldap-passport-stategy
  require('./passport_strategies/dummy.js')(passport); // register dummy-stategy

  app.get('/', loggedIn, function (req, res) {
      res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
      res.render('index', { user : req.user });
      res.end();
  });

  app.get('/login', function(req, res) {
      res.render('login', { user : req.user });
  });

  if (config_auth.required) {
    app.post('/login',
        passport.authenticate('activedirectory-login',
          {
            successRedirect: '/',
            failureRedirect: '/login' }),
        function(req,res) {
              // console.log("auth login");
        }
    );
  }
  else {
    app.post('/login',
        passport.authenticate('dummy',
          {
            successRedirect: '/',
            failureRedirect: '/login' }),
        function(req,res) {
        }
    );
  }

  app.get('/404', function (req, res) {
      res.render('404');
  });

  app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/login');
  });

  function loggedIn(req, res, next) {
      if (!config_auth.required || req.user) {
          next();
      } else {
          res.redirect('/login');
      }
  }
}
