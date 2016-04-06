'use strict';

const electron = require('electron');
const remote = require('electron').remote;
const ipcMain = require('electron').ipcMain;
const shell = require('electron').shell;
const app = electron.app; // Module to control application life.
const BrowserWindow = electron.BrowserWindow; // Module to create native browser window.

const WebvisualServer = require('./server.js');
var Settings = require('./settings');
var config;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

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

  config = new Settings(__dirname + '/../config/config.json');
  config.on("error", function(err) {
    console.log('Error in Config', err);
  });

  var webvisualserver = new WebvisualServer(config);
  webvisualserver.on("error", function(err) {
    console.log('Error in WebvisualServer', err);
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: false
  });


  // load server GUI
  mainWindow.loadURL('file://' + __dirname + '/app/index.html');

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    mainWindow = null;
  });

  // start server
  ipcMain.on('app-quit', function() {
    app.quit()
  });
  // start server
  ipcMain.on('server-start', function() {
    webvisualserver.connect();
  });
  // restart server
  ipcMain.on('server-restart', function() {
    webvisualserver.reconnect();
  });
  // stop server
  ipcMain.on('server-stop', function() {
    webvisualserver.disconnect();
  });
  // stop server
  ipcMain.on('open-client-view', function() {
    shell.openExternal('http://localhost:' + config.port.http);
  });

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
