// Routing

module.exports = function(app, passport) {

  app.get('/', loggedIn, function (req, res) {
      res.render('index', { user : req.user });
  });

  app.get('/login', function(req, res) {
      res.render('login', { user : req.user });
  });

  app.post('/login',
      passport.authenticate('activedirectory-login',
        {
          successRedirect: '/',
          failureRedirect: '/login' }),
      function(req,res) {
            // console.log("auth login");
      }
  );

  app.get('/404', function (req, res) {
      res.render('404');
  });

  app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/login');
  });

  function loggedIn(req, res, next) {
      if (req.user) {
          next();
      } else {
          res.redirect('/login');
      }
  }
}
