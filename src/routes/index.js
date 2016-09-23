// Routing
const
  EventEmitter = require('events').EventEmitter,
  fs = require('fs'),
  path = require('path');

class router extends EventEmitter {

  constructor(app, passport, config) {
    super();
    this.app = app;
    this.passport = passport;
    this.settings = {};
    this.configuration = {};

    this.app.get('/', (function(req, res) {
      if (this.settings.server.auth.required === true) {
        res.redirect('/login');
      }
      else {
        res.redirect('/index');
      }
    }).bind(this));

    this.app.get('/index', this.loggedIn.bind(this), (function(req, res) {
      res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
      res.render('index', {
        user: req.user,
        title: 'Webvisual Index',
        userConfigFiles: this.settings.userConfigFiles,
        renderer: this.settings.renderer,
        mobile: this.isMobile(req)
      });
      res.end();
    }).bind(this));

    this.app.get('/login', (function(req, res) {
      if (this.settings.server.auth.required === true) {
        res.render('login', {
          user: req.user,
          title: 'Webvisual Login',
          mobile: this.isMobile(req),
          server: this.settings.server
        });
      }
      else {
        res.redirect('/index');
      }
    }).bind(this));

    this.app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/login');
    });
  }

  setSettings(options) {
    if (options === undefined)
      this.emit("error", "Empty Configuration passed to router")
    for (let key in options) {
      if (key == 'server')
        this.setServer(options.server)
      else if (key == 'userConfigFiles')
        this.setUserConfig(options.userConfigFiles)
      else {
        this.settings[key] = options[key];
      }
    }
  }

  setServer(opt) {
    this.settings.server = opt;

    require('./passport_strategies/activedirectory.js')(this.passport, this.settings.server.auth.ldap); // register custom ldap-passport-stategy
    require('./passport_strategies/dummy.js')(this.passport); // register dummy-stategy

    if (this.settings.server.auth.required === true) {
      this.app.post('/login',
        this.passport.authenticate('activedirectory-login', {
          successRedirect: '/index',
          failureRedirect: '/login'
        }),
        function(req, res) {
          // console.log("auth login");
        }
      );
    } else {
      this.app.post('/login',
        this.passport.authenticate('dummy', {
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

    for (let name in userConfigFiles) {
      this.app.get('/' + name, this.loggedIn.bind(this), (function(req, res) {
        let name = req.url.substr(1);

        let rendererName = this.settings.userConfigFiles[name].renderer;
        let rendererPath = './renderer/' + this.settings.renderer[rendererName].path;

        console.log(rendererName, rendererPath);

        res.get('X-Frame-Options'); // prevent to render the page within an <iframe> element
        res.render(rendererPath, {
          user: req.user,
          title: name,
          name: name,
          config: this.configuration[name],
          mobile: this.isMobile(req)
        });
        res.end();
      }).bind(this));
    }
    this.app.use(function(req, res) {
      res.redirect('/login');
    });
  }

  setConfiguration(opt, name) {
    this.configuration[name] = opt;
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
    // console.log(ua);
    if (/mobile/i.test(ua) || /tablet/i.test(ua) || /android/i.test(ua))
      return true;
    else
      return false;
  }
}

module.exports = router;
