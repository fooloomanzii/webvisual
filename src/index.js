'use strict';

require('events').EventEmitter.prototype._maxListeners = 0;


const fs = require('fs'),
      path = require('path'),
      util = require('util');

const electron = require('electron')
    , remote = require('electron').remote
    , shell = require('electron').shell
    , app = electron.app
    , BrowserWindow = electron.BrowserWindow;

const { dialog } = require('electron');
const { ipcMain } = require('electron');

const WebvisualServer = require('./server')
    , Settings = require('./settings');

var appConfigLoader = {}
  , server
  , mainWindow = null
  , config;

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // OS X
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.

app.on('ready', () => {
  // Create the browser window.
  appConfigLoader = new Settings(app);

  appConfigLoader.on('error', (err) => {
    console.log('Error in Config', err);
  });

  appConfigLoader.on('ready', (msg, settings) => {
    console.log(msg);

    config = settings;
    mainWindow = new BrowserWindow(config.app);

    // load server GUI
    mainWindow.loadURL('file://' + __dirname + '/gui/index.html');

    server = new WebvisualServer(config);
    server.on('error', (err, msg) => {
      console.log('Error in', err, msg || '');
    });
    server.on('log', (arg, msg) => {
      console.log(arg, msg || '');
    });
    server.on('server-start', () => {
      mainWindow.webContents.send('event', 'server-start');
    });
    server.on('server-stop', () => {
      mainWindow.webContents.send('event', 'server-stop');
    });
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is going to be closed.
    mainWindow.on('close', () => {
      let bounds = mainWindow.getBounds();
      config.app.width = bounds.width;
      config.app.height = bounds.height;
      config.app.x = bounds.x;
      config.app.y = bounds.y;
      appConfigLoader.save(config);
    });
    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  });

  appConfigLoader.on('change', (settings) => {
    if (server.isRunning === true) {
      server.reconnect(settings);
    }
  });

  // app quit
  ipcMain.on('event', (e, event, arg) => {
    switch (event) {
      case 'ready':
        console.log = function() {
          mainWindow.webContents.send('log', util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.error = console.log;

        mainWindow.webContents.send('event', 'set-user-config', config.userConfigFiles);
        mainWindow.webContents.send('event', 'set-renderer', config.renderer);
        mainWindow.webContents.send('event', 'set-server-config', config.server);
        break;
      case 'server-start':
        server.connect();
        break;
      case 'server-restart':
        server.reconnect();
        break;
      case 'server-stop':
        server.disconnect();
        break;
      case 'server-toggle':
        server.toggle();
        break;
      case 'file-dialog':
        dialog.showOpenDialog({
          properties: ['openFile'],
          filters: arg.filter
        }, (files) => {
          sendPath(files, arg)
        });
        break;
      case 'folder-dialog':
        dialog.showOpenDialog({
          properties: ['openDirectory']
        }, (folder) => {
          sendPath(folder, arg)
        });
        break;
      case 'add-user-config':
        addConfigFile(arg);
        break;
      case 'remove-user-config':
        removeConfigFile(arg);
        break;
      case 'set-server-config':
        appConfigLoader.setEntry({
          server: arg
        });
        break;
    }
  });

  // addConfigFile
  function sendPath(files, arg) {
    mainWindow.webContents.send('event', 'file-dialog', {
      for: arg.for,
      path: (files && files.length > 0) ? files[0] : ''
    });
  }

  function addConfigFile(arg) {
    if (!arg.name)
      arg.name = 'tests';
    if (arg.path) {
      config.userConfigFiles[arg.name] = {
        path: arg.path,
        renderer: arg.renderer
      };
      appConfigLoader.set(config);
      mainWindow.webContents.send('event', 'set-user-config', config.userConfigFiles);
    }
  }

  function removeConfigFile(arg) {
    if (arg.name) {
      delete config.userConfigFiles[arg.name];
      appConfigLoader.set(config);
      mainWindow.webContents.send('event', 'set-user-config', config.userConfigFiles);
    }
  }

  /*
   * Handle process events
   */

  process.on('uncaughtException', (err) => {
    console.log('uncaughtException', err);
    // server.reconnect();
  });

  process.on('ECONNRESET', (err) => {
    console.log('connection reset (ECONNRESET)', err);
    // server.reconnect();
  });

  process.on('SIGINT', (err) => {
    console.log('close webvisual (SIGINT)');
    // server.disconnect();
    process.exit(0);
  });

  process.on('exit', (err) => {
    console.log('close webvisual (EXIT)');
    // server.disconnect();
  });
});
