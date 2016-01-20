'use strict';
/*
 * Module dependencies
 */
var // EXPRESS
    express = require('express'),
    // EXPRESS-ERROR-HANDLER
    errorHandler = require('express-error-handler'),
    // FS <-- File System
    fs = require('fs'),
    // UNDERSCORE <-- js extensions
    _ = require('underscore'),
    // DEFAULTSDEEP <-- extended underscrore/lodash _.defaults,
    // for default-value in   deeper structures
    defaultsDeep = require('merge-defaults'),
    // DATA-MODULE
    dataModule = require('./data_module'),
    // Routing
    ActiveDirectory = require('activedirectory'),
    xFrameOptions = require('x-frame-options'),
    session       = require('express-session'),
    passport      = require('passport'),
    LdapStrategy  = require('passport-ldapauth'),
    bodyParser    = require('body-parser'),
    cookieParser  = require('cookie-parser'),
    // routes = require('./routes/index'),
    // users = require('./routes/users'),

    /* Default config */

    defaults =
        {
          connections : [],
          port : 3000,
          updateIntervall : 1000,
          dbName : "test"
        },
    // Config Object
    config,
    // Logger
    winston = require('winston');

try {
  config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));
} catch (err) {
  console.warn('There has been an error parsing the config-file.')
      console.warn(err.stack);
}

// Use defaults for undefined values
config = defaultsDeep(config, defaults);

/*
 * Extend UNDERSCORE
 */
_.mixin({
  exclone : function(object, extra) {
    return _(object).chain().clone().extend(extra).value();
  }
});

// Checks for program arguments and runs the responsible operations
// e.g. "node app.js <arg1> <arg2>"
//   "-port <portnumber>" changes server port on <portnumber>
function checkArguments() {
  for (var i = 0; i < process.argv.length; i++) {
    switch (process.argv[i]) {
    case "-port": // next argument need to be a port number
      // isNaN() checks if content is not a number
      if (!isNaN(process.argv[++i])) {
        config.port = process.argv[i];
      } else { // next argument isn't a port number, so check it in next loop
        i--;
      }
      break;
    default:
      // react on unrecognized arguments
    }
  }
}

// check for program arguments
checkArguments();

// Configure SSL Encryption
var sslOptions  = {
    key: fs.readFileSync(__dirname + '/ssl/ca.key', 'utf8'),
    cert: fs.readFileSync(__dirname + '/ssl/ca.crt', 'utf8'),
	  ca: [ // Files for the certification path
          fs.readFileSync(__dirname + '/ssl/ca_DFN.crt', 'utf8'),
          fs.readFileSync(__dirname + '/ssl/ca_FZJ.crt', 'utf8')
        ],
    passphrase: require('./ssl/ca.pw.json').password,
    requestCert: true,
    rejectUnauthorized: false
  };

// *** Routing ***

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({ extended: true })); // get information from html form
app.use(bodyParser.json());
app.use(session({
    secret: 'i blame you!',
    resave: false,
    saveUninitialized: false
}));

require('./routes/auth/activedirectory.js')(passport, config); // pass passport for configuration

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

require('./routes/index.js')(app, passport); // load our routes and pass in our app and fully configured passport

/*
 * Server
 */

var server = require('https').createServer(sslOptions, app);

// if Error: EADDRINUSE --> log in console
server
    .on('error',
        function(e) {
          if (e.code == 'EADDRINUSE') {
            console.log('Port ' + config.port + ' in use, retrying...');
            console.log(
                "Please check if \"node.exe\" is not already running on this port.");
            setTimeout(function() {
              if (running)
                server.close();
              server.listen(config.port);
            }, 1000);
          }
        })
    .once('listening', function() {
      console.log("Server is running under Port %d in %s mode", config.port,
                  app.settings.env);
    });

// connect the DATA-Module
dataModule.connect(config, server);

/*
 * Handle various process events
 */

// After Server has started, we start the winston.logger
var logger = new winston.Logger({
  transports : [ new (winston.transports.Console)() ],
  exceptionHandlers : [
    new winston.transports.File(
        {filename : __dirname + config.logs.server_log})
  ],
  exitOnError : false
});

// TODO: make sure that the server is not closing (or is restarting) with errors
// and pretty this part
process.on('uncaughtException', function(err) {
  logger.log('error', err); // print error to the logger (console + file)
  try {
    server.close();
    dataModule.disconnect();
  } catch (e) {
    if (e.message !== 'Not running')
      throw e;
  }
  // try to reconnect
  // dataModule.connect(config,server);
});

process.on('ECONNRESET', function(err) {
  try {
    // server.close();
    // dataModule.disconnect();
  } catch (e) {
    if (e.message !== 'Not running')
      throw e;
  }
  // try to reconnect
  console.error('ECONNRESET: ' + err);
  // dataModule.connect(config,server);
});

/* SIGINT can usually be generated with Ctrl-C */
process.on('SIGINT', function(err) {
  try {
    console.log('close server');
    server.close();
    console.log('disconnect db');
    dataModule.disconnect();
  } catch (err) {
    if (err.message !== 'Not running')
      throw err;
  }

  console.warn(err.stack);
});

process.on('exit', function(err) {
  try {
    server.close();
    dataModule.disconnect();
  } catch (err) {
    if (err.message !== 'Not running')
      throw err;
  }
  if (err)
    console.warn(err.stack);
});

module.exports = app;
