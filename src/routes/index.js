var express = require('express');
var passport = require('passport');
var router = express.Router();

router.get('/', loggedIn, function (req, res) {
    res.render('index', { user : req.user });
});

router.get('/login', function(req, res) {
    console.log("get login");
    res.render('login', { user : req.user });
});

router.post('/login',
    passport.authenticate('ldapauth',
      {
        successRedirect: '/',
        failureRedirect: '/login' }),
    function(req,res) {
          console.log("auth login");
    }
);

router.get('/404', function (req, res) {
    res.render('404');
});

router.get('/logout', function(req, res) {
    console.log("get logout");
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

module.exports = router;


// router.post('/login', passport.authenticate('ldapauth', {session: true, successRedirect: '/', failureRedirect: '/login' }), function(req, res) {
//   res.send({status: 'ok'});
// });

// router.post('/login', passport.authenticate('local-login', {
//       successRedirect : '/profile', // redirect to the secure profile section
//       failureRedirect : '/login', // redirect back to the signup page if there is an error
//       failureFlash : true // allow flash messages
//   }));

// router.get('/login', function(req, res) {
//       console.log("get /login");
//     res.render('/login/index.html', { message: "" });
// });
//
// router.get('/logout', function(req, res) {
//   req.logout();
//   res.redirect('/');
// });


/**
 * function: Route in Public Filesystem
 */
// function route(route_path, json_obj) {
//   console.log("route");
//   json_obj.path = "/" + route_path;
//
//   return function(req, res) {
//     res.get('X-Frame-Options');
//     res.render(route_path, json_obj);
//     res.end();
//   };
// }

/**
 * Authentication (LDAP)
 */
// function authenticate(req){
//
//   if (req == undefined || !req.username || !req.password) {
//     console.log("missing arguments");
//     return {status: "Error"};
//   }
//
//   // if user is already logged in, then route forward
//   for (var i = 0; i < users.length; i++) {
//     if (users[i].username == req.username && users[i].isEnabled) {
//       return {status: "IsEnabled", user: users[i]};
//     }
//   }
//
//   var cred = { url: config.ldap.url,
//                baseDN: config.ldap.baseDN,
//                username: req.username,
//                password: req.password
//              };
//   // try to bring user-input in a form which is accepted by the server
//   try {
//     if (cred.username.split("\\").length > 1) {
//       cred.username = cred.username.split("\\")[1];
//     }
//     if (cred.url.indexOf('ldap:\\\\') != 0) {
//       cred.url = 'ldap:\\\\' + cred.url;
//     }
//     if (cred.username.split("@").length > 1) {
//       if (cred.username.split("@")[1] != cred.url.split('ldap:\\\\')[1])
//         cred.username = cred.username.split("@")[0] + "@" + cred.url.split('ldap:\\\\')[1];
//     }
//     else {
//       cred.username = cred.username + "@" + cred.url.split('ldap:\\\\')[1];
//     }
//   }
//   catch (err) {
//     console.log("err");
//     return {status: "Error"};
//   }
//
//   var ad = new ActiveDirectory(cred);
//   console.log(JSON.stringify(cred));
//
//   // check, if user exists on server
//   ad.userExists(cred.username, function(err, exists) {
//     if (err) {
//       console.log("exist err ");
//       return {status: "NotUser"};
//     }
//     // check, if user can authenticate
//     if(exists) {
//       ad.authenticate(cred.username, cred.password, function(err, auth) {
//         if (auth) {
//           console.log("auth");
//           users.push({"username": cred.username, "isEnabled": true})
//           route("index.html",{"username": req.username});
//           return {status: "IsEnabled", user: {"username": cred.username, "isEnabled": true}};
//         }
//         else {
//           console.log("auth err");
//           return {status: "Failed"};
//         }
//       });
//     }
//   });
// };

/**
 * Routes
 */

// Defaults
// router.get('/', session, function(req, res){
//   console.log("/");
//   res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
// });
//
// router.get('/index', session, function(req, res){
//   console.log("index");
//   res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
// });

/**
 * Login
 */

// router.post("/", session, function(req, res) {
//
//   console.log("req.body: "+req.body);
//   if(req.body.username && req.body.password) {
//       // check username and password
//       var check = authenticate({"username": req.body.username, "password": req.body.password});
//       console.log("check:" + check);
//       switch (check) {
//         case "IsEnabled":
//           //  res.redirect(__dirname + '/../public/index.html', {title : 'WebVisual'});
//            route("index.html",{"username": req.body.username});
//            return;
//         case "NotUser":
//            res.redirect(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
//            return;
//         case "IsEnabled":
//            res.redirect(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
//            return;
//         case "Error":
//            res.redirect(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
//            return;
//        }
//    }
// });
//
// router.get('/login', session, function(req, res){
//   console.log("login");
//   res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
// });
//
// /**
//  * Logout
//  */
// router.get('/logout', session, function(req, res){
//   console.log("logout");
//   for (var i = 0; i < users.length; i++) {
//     if (users[i].username == req.username) {
//       users.splice(i-1, 1);
//       break;
//     }
//   }
//   res.render(__dirname + '/../public/login/index.html', {title : 'WebVisual Login'});
// });
//
// // Error: Custom 404 page
// router.use(function(req, res) {
//   res.status(404);
//
//   // Respond with html page
//   if (req.accepts('html')) {
//     res.render('404');
//   }
// });
//
// // External Logfile (file path from config.json)
// router.get('/log', session, function(req, res){
//   var filepath;
//   if (!config.logs.external_log_path || config.logs.external_log_path == "")
//     filepath =
//         path.resolve(__dirname + '/../../../logs/' + config.logs.external_log);
//   else
//     filepath = path.resolve(config.logs.external_log_path +
//                             config.logs.external_log);
//
//   var text = fs.readFile(filepath, function(err, data) { res.send(data); });
// });
//
// // Data File (file path from config.json)
// router.get(__dirname + '/../public/data', session, function(req, res){
//   var filepath;
//
//   if (!config.connections.file.path_folder ||
//       config.connections.file.path_folder == "")
//     filepath = path.resolve(__dirname + '/../../../data/' +
//                             config.connections.file.path);
//   else
//     filepath = path.resolve(config.connections.file.path_folder +
//                             config.connections.file.path);
//
//   var text = fs.readFile(filepath, function(err, data) { res.send(data); });
// });
//
// // Configuration    (send config.json)
// router.get('/settings', session, function(req, res){
//   var filepath = path.resolve(__dirname + '/../../config/config.json');
//   var text = fs.readFile(filepath, function(err, data) { res.send(data); });
// });
