// require('events').EventEmitter.prototype._maxListeners = 0;

const fs = require('fs'),
      path = require('path'),
      util = require('util');

const electron = require('electron');
const { dialog, ipcMain, app, BrowserWindow } = require('electron');

const fork = require('child_process').fork;

let Settings = require('./settings');
let Server;

let configLoader = {}
  , win = null
  , config;

function createWindow (config) {
  // Create the browser window.
  win = new BrowserWindow(config)

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/gui/index.html`)

  // Open the DevTools.
  win.webContents.openDevTools()

  // Emitted when the window is going to be closed.
  win.on('close', () => {
    let bounds = win.getBounds();
    config.app.width = bounds.width;
    config.app.height = bounds.height;
    config.app.x = bounds.x;
    config.app.y = bounds.y;
    configLoader.save( config );
  });

  // Emitted when the window is closed.
  win.on('closed', () => {
    win = null
  })
}

function createServer (config) {
  var env = JSON.parse(JSON.stringify(process.env));
  env['WEBVISUALSERVER'] = config;
  env.port = config.server.port;
  Server = fork( __dirname + '/server/index.js', [], { env: env, cwd: __dirname + '/server' } );
  Server.on('message', (arg) => {
    if (win) {
      for (var type in arg) {
        win.webContents.send( type, arg[type] );
      }
    } else {
      console.log( arg[type] );
    }
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // OS X
  if (process.platform != 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('ready', () => {
  // Create the browser window.
  configLoader = new Settings(app);

  configLoader.on('error', (err) => {
    console.error('Error in AppConfig', err);
  });

  configLoader.on('ready', (msg, settings) => {
    config = settings;
    createServer(config);
    createWindow(config);
  });

  configLoader.on('change', (settings) => {
    config = settings;
    Server.send( { reconnect: config } );
  });

  // ipc beetween gui and process
  ipcMain.on('event', (e, event, arg) => {
    switch (event) {
      case 'ready':
        console.log = function() {
          win.webContents.send('log', util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.info = function() {
          win.webContents.send('info', util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.warn = function() {
          win.webContents.send('warn', util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }
        console.error = function() {
          win.webContents.send('error', util.format.apply(null, arguments) + '\n');
          process.stdout.write(util.format.apply(null, arguments) + '\n');
        }

        win.webContents.send('event', 'set-user-config', config.userConfigFiles);
        // win.webContents.send('event', 'set-renderer', config.renderer);
        win.webContents.send('event', 'set-server-config', config.server);
        break;
      case 'server-start':
        Server.send( { connect: config } );
        break;
      case 'server-restart':
        Server.send( { reconnect: config } );
        break;
      case 'server-stop':
        Server.send( { disconnect: {} } );
        break;
      case 'server-toggle':
        Server.send( { toggle: config } );
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
        configLoader.setEntry({
          server: arg
        });
        break;
    }
  });
});

// addConfigFile
function sendPath(files, arg) {
  win.webContents.send('event', 'file-dialog', {
    for: arg.for,
    path: (files && files.length > 0) ? files[0] : ''
  });
}

function addConfigFile(arg) {
  if (!arg.name || !arg.title || !arg.path)
    return;

  for (var i in config.userConfigFiles) {
    if (config.userConfigFiles[i].name === arg.name) {
      config.userConfigFiles[i].title = arg.title;
      config.userConfigFiles[i].path = arg.path;
      configLoader.set(config);
      win.webContents.send('event', 'set-user-config', config.userConfigFiles);
      return;
    }
  }

  config.userConfigFiles.push({
    name: arg.name,
    title: arg.title,
    path: arg.path
  });
  configLoader.set(config);
  win.webContents.send('event', 'set-user-config', config.userConfigFiles);

}

function removeConfigFile(arg) {
  if (arg.name) {
    delete config.userConfigFiles[arg.name];
    configLoader.set(config);
    win.webContents.send('event', 'set-user-config', config.userConfigFiles);
  }
}

/*
 * Handle process events
 */

process.on('uncaughtException', (err) => {
  console.log('uncaughtException', err);
  // Server.reconnect();
});

process.on('ECONNRESET', (err) => {
  console.log('connection reset (ECONNRESET)', err);
  // Server.reconnect();
});

process.on('SIGINT', (err) => {
  console.log('close webvisual (SIGINT)');
  // Server.disconnect();
  process.exit(0);
});

process.on('exit', (err) => {
  console.log('close webvisual (EXIT)');
  // Server.disconnect();
});
