'use strict';

var electron = require('electron');
var remote = require('electron').remote;
const {ipcMain} = require('electron');
var shell = require('electron').shell;
var util = require('util');

var app = electron.app; // Module to control application life.
var BrowserWindow = electron.BrowserWindow; // Module to create native browser window.

var fs = require('fs'),
  path = require('path');

var WebvisualServer = require('./server.js');
var webvisualserver;
var Settings = require('./settings');
var appConfigLoader = {};

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
    // Create the browser window.
    appConfigLoader = new Settings(app);
    appConfigLoader.on('error', function(err) {
      console.log('Error in Config', err);
    });
    appConfigLoader.on('ready', function(msg, settings) {
      console.log(msg);

      mainWindow = new BrowserWindow(settings.app);

      // load server GUI
      mainWindow.loadURL('file://' + __dirname + '/public/app.html');

      mainWindow.webContents.on('dom-ready', () => {
        // Log to main process
        console.log = function () {
          mainWindow.webContents.send("log", util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.error = console.log;
      });

      webvisualserver = new WebvisualServer(settings);
      webvisualserver.on('error', function(err) {
        console.log('Error in WebvisualServer', err);
      });
      // Open the DevTools.
      // mainWindow.webContents.openDevTools();

      // Emitted when the window is going to be closed.
      mainWindow.on('close', function() {
        let bounds = mainWindow.getBounds();
        settings.app.width = bounds.width;
        settings.app.height = bounds.height;
        settings.app.x = bounds.x;
        settings.app.y = bounds.y;
        appConfigLoader.save(settings);
      });
      // Emitted when the window is closed.
      mainWindow.on('closed', function() {
        mainWindow = null;
      });
    });

  // app quit
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
    // webvisualserver.reconnect();
  });

  process.on('ECONNRESET', function(err) {
    console.log('connection reset (ECONNRESET)', err);
    // webvisualserver.reconnect();
  });

  process.on('SIGINT', function(err) {
    console.log('close webvisual (SIGINT)');
    // webvisualserver.disconnect();
    process.exit(0);
  });

  process.on('exit', function(err) {
    console.log('close webvisual (EXIT)');
    // webvisualserver.disconnect();
  });
});
