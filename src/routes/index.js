  'use strict';

  var fs = require('fs'),
      path = require('path'),
      config = require('../config/config.json'),
      ActiveDirectory = require('activedirectory');

  var users = [];

module.exports = function(app){
      console.log("init");

  app.engine('html', require('ejs').renderFile);

  /**
   * function: Route in Public Filesystem
   */
  function route(route_path, json_obj) {
    console.log("route");
    json_obj.path = "/" + route_path;

    return function(req, res) {
      res.get('X-Frame-Options');
      res.render(route_path, json_obj);
      res.end();
    };
  }

  /**
   * Authentication (LDAP)
   */
  function authenticate(req){

    // if user is already logged in, then route forward
    for (user in users) {
      if (user.isEnabled) {
        return {msg: "isEnabled"};
      }
    }

    var cred = { url: config.ldap.url,
                 baseDN: config.ldap.baseDN,
                 username: req.username,
                 password: req.password
               };
    // try to bring user input in a form which is accepted by the server
    try {
      if (cred.username.split("\\").length > 1) {
        cred.username = cred.username.split("\\")[1];
        console.log(cred.username);
      }
      if (cred.url.indexOf('ldap:\\\\') == -1) {
        cred.url = 'ldap:\\\\' + cred.url;
        console.log(cred.url);
      }
      if (cred.username.indexOf("@" + config.ldap.url) == -1) {
        cred.username += "@" + config.ldap.url;
        console.log(cred.username);
      }
    }
    catch (err) {
      console.log("err");
      return {msg: "ParseError"};
    }

    var ad = new ActiveDirectory(cred);
    console.log(JSON.stringify(cred));

    // check, if user exists on server
    ad.userExists(cred.username, function(err, exists) {
      if (err) {
        console.log("exist err ");
        return {msg: "NotUser"};
      }
      // check, if user can authenticate
      if(exists) {
        ad.authenticate(cred.username, cred.password, function(err, auth) {
          if (auth) {
            console.log("auth");
            user.push({"username": username, "isEnabled": true})
            return {msg: "IsEnabled"};
          }
          else {
            console.log("auth err");
            return {msg: "Failed"};
          }
        });
      }
    });
  };

  /**
   * Routes
   */

  // Defaults
  app.get('/', function(req, res){
    console.log("/");
    res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
  });

  app.get('/index', function(req, res){
    console.log("index");
    res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
  });

  /**
   * Login
   */

  app.post("/login", function(req, res) {

    console.log(req.body);
    if(req.body.username && req.body.password) {
        // check username and password
        check = authenticate({"username": req.body.username, "password": req.body.password});

        switch (check) {
          case "IsEnabled":
             res.redirect(__dirname + '/../public/index.html', {title : 'WebVisual Login'});
             return;
          case "NotUser":
             res.redirect(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
             return;
          case "IsEnabled":
             res.redirect(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
             return;
          case "ParseError":
             res.redirect(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
             return;
         }
     }
  });

  app.get('/login', function(req, res){
    console.log("login");
    res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
  });

  /**
   * Logout
   */
  app.get('/logout', function(req, res){
    console.log("logout");
    for (var i = 0; i < users.length; i++) {
      if (users[i].username == req.username) {
        users.splice(i-1, 1);
        break;
      }
    }
    res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
  });

  // Error: Custom 404 page
  app.use(function(req, res) {
    res.status(404);

    // Respond with html page
    if (req.accepts('html')) {
      res.render('404');
    }
  });

  // External Logfile (file path from config.json)
  app.get('/log', function(req, res){
    var filepath;
    if (!config.logs.external_log_path || config.logs.external_log_path == "")
      filepath =
          path.resolve(__dirname + '/../../../logs/' + config.logs.external_log);
    else
      filepath = path.resolve(config.logs.external_log_path +
                              config.logs.external_log);

    var text = fs.readFile(filepath, function(err, data) { res.send(data); });
  });

  // Data File (file path from config.json)
  app.get(__dirname + '/../public/data', function(req, res){
    var filepath;

    if (!config.connections.file.path_folder ||
        config.connections.file.path_folder == "")
      filepath = path.resolve(__dirname + '/../../../data/' +
                              config.connections.file.path);
    else
      filepath = path.resolve(config.connections.file.path_folder +
                              config.connections.file.path);

    var text = fs.readFile(filepath, function(err, data) { res.send(data); });
  });

  // Configuration    (send config.json)
  app.get('/settings', function(req, res){
    var filepath = path.resolve(__dirname + '/../../config/config.json');
    var text = fs.readFile(filepath, function(err, data) { res.send(data); });
  });

}
