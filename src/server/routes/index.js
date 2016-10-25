// Routing
const
  EventEmitter = require('events')
  .EventEmitter,
  passport = require('passport'),
  fs = require('fs'),
  path = require('path');

class router extends EventEmitter {

  constructor(app, config) {
    super();
    this.app = app;
    this.settings = {};
    this.configuration = {};

    this.app.get('/', (req, res) => {
      if (this.settings.server.auth.required === true) {
        res.redirect('/login');
      } else {
        res.redirect('/index');
      }
    });

    this.app.get('/index', this.loggedIn.bind(this), (req, res) => {
      res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
      res.render('index', {
        user: req.user,
        title: 'Webvisual Index',
        userConfigFiles: this.settings.userConfigFiles,
        renderer: this.settings.renderer,
        mobile: this.isMobile(req)
      });
      res.end();
    });

    this.app.get('/login', (req, res) => {
      if (this.settings.server.auth.required === true) {
        res.render('login', {
          user: req.user,
          title: 'Webvisual Login',
          mobile: this.isMobile(req),
          server: this.settings.server
        });
      } else {
        res.redirect('/index');
      }
    });

    this.app.get('/logout', (req, res) => {
      req.logout();
      res.redirect('/login');
    });
  }

  setSettings(options) {
    if (options === undefined)
      this.emit("error", "Empty Configuration passed to router");
    for (let key in options) {
      if (key == 'server')
        this.setServer(options.server);
      else if (key == 'userConfigFiles')
        this.setUserConfig(options.userConfigFiles);
      else {
        this.settings[key] = options[key];
      }
    }
  }

  setServer(opt) {
    this.settings.server = opt;

    require('./authentification_strategies/activedirectory.js')(this.settings.server.auth.ldap); // register custom ldap-passport-stategy
    require('./authentification_strategies/dummy.js')(); // register dummy-stategy

    if (this.settings.server.auth.required === true) {
      this.app.post('/login',
        passport.authenticate('activedirectory-login', {
          successRedirect: '/index',
          failureRedirect: '/login'
        }),
        function(req, res) {
          // console.log("auth login");
        }
      );
    } else {
      this.app.post('/login',
        passport.authenticate('dummy', {
          successRedirect: '/index',
          failureRedirect: '/index'
        }),
        function(req, res) {
          // console.log("no-auth login");
        }
      );
    }
  }

  setUserConfig(userConfigFiles) {
    this.settings.userConfigFiles = userConfigFiles;

    for (let route in userConfigFiles) {
      this.app.get('/' + route, this.loggedIn.bind(this), (req, res) => {
        let route = req.url.substr(1);

        if (!route || !this.settings.userConfigFiles[route] || !this.settings.userConfigFiles[route].renderer) {
          this.emit("error", "Requested Renderer for '" + route + "' not found.");
          res.redirect('/index');
          res.end();
          return;
        }
        let rendererName = this.settings.userConfigFiles[route].renderer;
        let rendererPath = './renderer/' + this.settings.renderer[rendererName].path;

        res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
        res.render(rendererPath, {
          user: req.user,
          title: route,
          route: route,
          config: this.configuration[route].configuration,
          mobile: this.isMobile(req)
        });
        res.end();
      });
    }
    this.app.use(function(req, res) {
      res.redirect('/login');
    });
  }

  setConfiguration(opt, route) {
    this.configuration[route] = opt;
    // console.log(this.configuration);
  }

  loggedIn(req, res, next) {
    if (this.settings.server.auth.required === false || req.user) {
      next();
    } else {
      res.redirect('/login');
    }
  }

  isMobile(req) {
    var ua = req.header('user-agent');
    // console.log(ua, '\n', /[mM]obi/i.test(ua) || /[tT]ablet/i.test(ua) || /[aA]ndroid/i.test(ua));
    if (/[mM]obi/i.test(ua) || /[tT]ablet/i.test(ua) || /[aA]ndroid/i.test(ua))
      return true;
    else
      return false;
  }
}

module.exports = router;
