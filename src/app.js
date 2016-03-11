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
  xFrameOptions = require('x-frame-options'),
  session = require('express-session'),
  passport = require('passport'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),

  /* Default config */

  defaults = {
    connections: [],
    port: 3000,
    updateIntervall: 1000,
    dbName: "test"
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
  exclone: function(object, extra) {
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

// *** Routing ***

var app = express(),
  httpApp = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
  extended: true
})); // get information from html form
app.use(bodyParser.json());

app.use(session({
  secret: '&hkG#1dwwh!',
  resave: false,
  saveUninitialized: false
}));

// Prevent Clickjacking
app.use(xFrameOptions());

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

require('./routes/index.js')(app, passport, config.auth); // load our routes and pass in our app and fully configured passport

// Routing to https if http is requested
httpApp.set('port', 80);
httpApp.get("*", function(req, res, next) {
  res.redirect("https://" + req.headers.host + ':' + config.port + req.path);
});

/*
 * Server
 */

// Configure SSL Encryption
var sslOptions = {
  key: fs.readFileSync(__dirname + '/ssl/ca.key', 'utf8'),
  cert: fs.readFileSync(__dirname + '/ssl/ca.crt', 'utf8'),
  passphrase: require('./ssl/ca.pw.json').password,
  requestCert: true,
  rejectUnauthorized: false
};

try {
  // Read files for the certification path
  var cert_chain = [];
  fs.readdirSync(__dirname + '/ssl/cert_chain').forEach(function(filename) {
    cert_chain.push(
      fs.readFileSync(__dirname + '/ssl/cert_chain/' + filename, 'utf-8'));
  });
  sslOptions.ca = cert_chain;
} catch (err) {
  console.warn("Cannot open '/ssl/cert_chain' to read Certification chain");
}

// start Server
var server = require('https').createServer(sslOptions, app);
var httpServer = require('http').createServer(httpApp)
                                .listen(httpApp.get('port'), function() {
                                    console.log('HTTP server is listening on port ' + httpApp.get('port') + ' for redirecting to https');
                                  });

// if Error: EADDRINUSE --> log in console
server.on('error',
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
        console.log("HTTPS Server is listening on port %d in %s mode", config.port,
          app.settings.env);
      });

// connect the DATA-Module
dataModule.connect(config, server);

/*
 * Handle various process events
 */

// After Server has started, we start the winston.logger
var logger = new winston.Logger({
  transports: [new(winston.transports.Console)()],
  exceptionHandlers: [
    new winston.transports.File({
      filename: __dirname + config.logs.server_log
    })
  ],
  exitOnError: false
});

/* TODO: make sure that the server is not closing (or is restarting) with errors
 *      Maybe just count the restarts within given time,
 *      so if it's totally crashed, it will not try to restart anymore. */

process.on('uncaughtException', function(err) {
  logger.log('error', err); // print error to the logger (console + file)
  try {
    server.close();
  } catch (e) {
    if (e.message !== 'Not running')
      throw e;
  }
  //try to reconnect
  dataModule.disconnect();
  dataModule.connect(config, server);
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
