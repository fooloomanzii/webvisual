'use strict';

var electron = require('electron');
var remote = require('electron').remote;
const {ipcMain} = require('electron');
var shell = require('electron').shell;

var app = electron.app; // Module to control application life.
var BrowserWindow = electron.BrowserWindow; // Module to create native browser window.

var fs = require('fs'),
  path = require('path');

var WebvisualServer = require('./server.js');
var Settings = require('./settings');
var config = {},
  appConfig = {};

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var clientView = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // OS X
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // check User Data and folder
  let appConfigFilePath = path.join(app.getPath('userData'), 'config', 'appConfig.json');
  fs.access(appConfigFilePath, fs.F_OK, function(err) {
    if (!err) {
      try {
        appConfig = JSON.parse(fs.readFileSync(appConfigFilePath));
      } catch (e) {
        err = true;
      }
    }
    if (err) {
      mkdirp(path.join(app.getPath('userData'), 'config'));
      copyFile(path.join(__dirname, 'settings', 'defaults', 'appConfig.json'), appConfigFilePath, function(err) {});
      appConfig =
        JSON.parse(fs.readFileSync(path.join(__dirname, 'settings', 'defaults', 'appConfig.json')));
    }
    // Create the browser window.
    mainWindow = new BrowserWindow(appConfig.options);

    // load server GUI
    mainWindow.loadURL('file://' + __dirname + '/index.html');

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      mainWindow = null;
    });
  });

  config = new Settings(path.join(__dirname, 'settings', 'defaults', 'userConfig.json'), app);
  config.on('error', function(err) {
    console.log('Error in Config', err);
  });

  var webvisualserver = new WebvisualServer(config);
  webvisualserver.on('error', function(err) {
    console.log('Error in WebvisualServer', err);
  });



  // start server
  ipcMain.on('app-quit', (event, arg) => {
    app.quit()
  });
  // start server
  ipcMain.on('server-start', (event, arg) => {
    webvisualserver.connect();
  });
  // restart server
  ipcMain.on('server-restart', (event, arg) => {
    webvisualserver.reconnect();
  });
  // stop server
  ipcMain.on('server-stop', (event, arg) => {
    webvisualserver.disconnect();
  });
  // clientView
  // ipcMain.on('open-client-view', function() {
  //   clientView = new BrowserWindow(appConfig.options);
  //   clientView.loadURL('https://127.0.0.1:3000/login');
  // });

  /*
   * Handle various process events
   */

  process.on('uncaughtException', function(err) {
    console.log('uncaughtException', err);
    webvisualserver.reconnect();
  });

  process.on('ECONNRESET', function(err) {
    console.log('connection reset (ECONNRESET)', err);
    webvisualserver.reconnect();
  });

  process.on('SIGINT', function(err) {
    console.log('close server (SIGINT)');
    webvisualserver.disconnect();
    process.exit(0);
  });

  process.on('exit', function(err) {
    console.log('close server (EXIT)');
    webvisualserver.disconnect();
  });
});

function checkFolder(path_folder, callback) {
  fs.access(path, fs.F_OK, function(err) {
    if (!err) {
      // Do something
    } else {
      // It isn't accessible
    }
  });
}

var mkdirp = function(path, callback) {
  fs.mkdir(path, "0o777", function(err) {
    if (callback) callback(err);
  });
}

function copyFile(source, target, callback) {
  var callbackCalled = false;

  var rd = fs.createReadStream(source);
  rd.on("error", done);

  var wr = fs.createWriteStream(target);
  wr.on("error", done);
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!callbackCalled) {
      callback(err);
      callbackCalled = true;
    }
  }
}
