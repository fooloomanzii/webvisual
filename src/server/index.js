'use strict';

// System Modules
const express = require('express'),
  fs = require('fs'),
  path = require('path'),
  EventEmitter = require('events').EventEmitter,

  // Processing Modules
  DataModule = require('./data_module'),
  Router = require('./routes'),
  ConfigFileProcessor = require('./config_file_processor'),

  // Sessions & Authentification
  xFrameOptions = require('x-frame-options'),
  session = require('express-session'),
  passport = require('passport'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  compression = require('compression'),

  // Server
  spdy = require('spdy'),
  app = express();

// Defaults
var defaultSSLOptions = {
  key: path.resolve(__dirname, 'examples', 'ssl', 'ca.key'),
  cert: path.resolve(__dirname, 'examples', 'ssl', 'ca.crt'),
  passphrase: path.resolve(__dirname, 'examples', 'ssl', 'ca.pw.json'),
  ca: [],
  requestCert: true,
  rejectUnauthorized: false
};

// use compression
app.use(compression());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// get cookies from http requests
app.use(cookieParser());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

app.use(session({
  secret: '&hkG#1dwwh!',
  resave: false,
  saveUninitialized: false
}));

// Prevent Clickjacking
app.use(xFrameOptions());

// compress responses
app.use(compression())

// register for authentification
app.use(passport.initialize());

// init session handler
app.use(passport.session());

// static dir
app.use(express.static(path.join(__dirname, 'public', 'www')));

class WebvisualServer extends EventEmitter {

  constructor(settings) {
    super();
    this.isRunning = false;
    this.config = settings;

    this.router = new Router(app, passport);
    this.router.on('error', (err) => {
      this.emit('error', err);
    });

    this.dataHandler = new DataModule();
    this.configFilesHandler = new ConfigFileProcessor();

    this.configFilesHandler.on('changed', (route) => {
      this.dataHandler.setConfiguration(this.configFilesHandler.settings[route], route);
      this.router.setConfiguration(this.configFilesHandler.settings[route], route); // load Settings to Routen them to requests
    });
    this.dataHandler.on('error', (err) => {
      this.emit('error', err);
    });
  }

  createServer(settings, callback) {
    return new Promise((resolve, reject) => {
      if (settings)
        this.config = settings;

      if (this.isRunning)
        this.disconnect();

      this.isHttps = false;
      this.router.setSettings(settings || this.config);

      let sslOptions = defaultSSLOptions;
      sslOptions.port = this.config.server.port.http2 || 443;

      try {
        // use https & http-redirecting
        if (this.config.server.ssl &&
          this.config.server.ssl.cert &&
          this.config.server.ssl.key &&
          this.config.server.ssl.passphrase) {
          sslOptions.cert = path.resolve(this.config.server.ssl.cert);
          sslOptions.key = path.resolve(this.config.server.ssl.key);
          sslOptions.passphrase = path.resolve(this.config.server.ssl.passphrase);
        }

        fs.access(sslOptions.cert, fs.constants.R_OK, (err) => {
          if (err)
            throw new Error(`File for certification (ssl) not found \n ${err}`);
          else {
            fs.access(sslOptions.key, fs.constants.R_OK, (err) => {
              if (err)
                throw new Error(`File for public key (ssl) not found \n ${err}`);
              else {
                fs.access(sslOptions.passphrase, fs.constants.R_OK, (err) => {
                  if (err)
                    throw new Error(`File for passphrase (ssl) not found \n ${err}`);
                  else {
                    // Configure SSL Encryption
                    sslOptions.key = fs.readFileSync(sslOptions.key, 'utf8');
                    sslOptions.cert = fs.readFileSync(sslOptions.cert, 'utf8');
                    sslOptions.passphrase = require(sslOptions.passphrase)
                      .password;
                    resolve(sslOptions);
                  }
                });
              }
            });
          }
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  connect(settings) {
    // connect the DATA-Module
    if (this.isRunning === false) {
      this.emit('log', 'WebvisualServer is starting');
      this.createServer(settings)
        .then((sslOptions) => {
          if (this.http2)
            this.http2.close();
          this.http2 = spdy.createServer(sslOptions, app);
          this.http2.on('error', (e) => {
              if (e.code === 'EADDRINUSE') {
                this.emit('error', `HTTP2 Server \n Port ${this.config.server.port.http2} in use. Please check if node.exe is not already running on this port.`);
                this.http2.close();
              } else if (e.code === 'EACCES') {
                this.emit('error', `HTTP2 Server \n Network not accessable. Port ${this.config.server.port.http2} might be in use by another application. Try to switch the port or quit the application, which is using this port`);
              } else {
                this.emit('error', e);
              }
            })
            .once('listening', () => {
              this.emit('log', `HTTP2 Server is listening on port ${this.config.server.port.http2}`);
            });
          this.dataHandler.setServer(this.http2);
          this.http2.listen(this.config.server.port.https || 443);
          this.configFilesHandler.watch(this.config.userConfigFiles);
          this.isRunning = true;
          this.emit('server-start');
        })
        .catch( (err) => {
          this.emit('error', `in SSL Configuration \n ${err}`)
        });
    }
  }

  disconnect() {
    this.emit('log', 'WebvisualServer is closing');
    if (this.http2)
      this.http2.close();
    this.configFilesHandler.unwatch();
    this.dataHandler.disconnect();
    this.isRunning = false;
    this.emit('server-stop');
  }

  reconnect(settings) {
    if (settings)
      this.config = settings;
    if (this.isRunning)
      this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 2500);
  }

  toggle(settings) {
    if (settings)
      this.config = settings;
    if (this.isRunning)
      this.disconnect();
    else
      this.connect();
  }
};

module.exports = WebvisualServer;
