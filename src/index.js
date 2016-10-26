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


const fork = require('child_process').fork;

const server = fork( __dirname + '/server/index.js', [], { env: process.env } )
    , Settings = require('./settings');

server.on('message', (arg) => {
  console.log(arg);
  for (var type in arg) {
    switch (type) {
      case 'event':
        if (mainWindow)
          mainWindow.webContents.send( 'event', arg[type] );
        break;
      case 'error':
        console.error( arg[type] );
        break;
      case 'log':
      default:
        console.log( arg[type] )
    }
  }
});

server.send({test: 'test'});

var appConfigLoader = {}
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
    console.error('Error in AppConfig', err);
  });

  appConfigLoader.on('ready', (msg, settings) => {
    console.info(msg);

    config = settings;
    mainWindow = new BrowserWindow(config.app);

    // load server GUI
    mainWindow.loadURL('file://' + __dirname + '/gui/index.html');

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    // Emitted when the window is going to be closed.
    mainWindow.on('close', () => {
      let bounds = mainWindow.getBounds();
      config.app.width = bounds.width;
      config.app.height = bounds.height;
      config.app.x = bounds.x;
      config.app.y = bounds.y;
      appConfigLoader.save( config );
    });
    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  });

  appConfigLoader.on('change', (settings) => {
    config = settings;
    server.send( { reconnect: config } );
  });

  // app quit
  ipcMain.on('event', (e, event, arg) => {
    switch (event) {
      case 'ready':
        console.log = function() {
          mainWindow.webContents.send('log', util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.info = console.warn = console.error = console.log;

        mainWindow.webContents.send('event', 'set-user-config', config.userConfigFiles);
        mainWindow.webContents.send('event', 'set-renderer', config.renderer);
        mainWindow.webContents.send('event', 'set-server-config', config.server);
        break;
      case 'server-start':
        server.send( { connect: config } );
        break;
      case 'server-restart':
        server.send( { reconnect: config } );
        break;
      case 'server-stop':
        server.send( { disconnect: {} } );
        break;
      case 'server-toggle':
        server.send( { toggle: config } );
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
