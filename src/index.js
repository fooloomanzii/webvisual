// require('events').EventEmitter.prototype._maxListeners = 0
process.env.NODE_ENV = 'production'

const fs = require('fs'),
      path = require('path'),
      util = require('util');

const electron = require('electron')
const { dialog, ipcMain, app, BrowserWindow } = require('electron')

// change RAM-limit
app.commandLine.appendSwitch("js-flags", "--max_old_space_size=6000")

const fork = require('child_process').fork

let Settings = require('./settings')
let server

let configLoader = {}
  , config
  , activeErrorRestartJob
  , window_main
  , window_configfiles
  , window_serverconfig
  , window_databaseconfig
  , window_bounds = {};

function createWindow (config, url, title = 'app') {
  // Create the browser window.
  var window = new BrowserWindow(config)

  // and load the main.html of the app.
  window.loadURL(url)

  // Open the DevTools.
  // window_main.webContents.openDevTools()

  // Emitted when the window is going to be closed.
  window.on('close', () => {
    window_bounds[title] = window.getBounds()
  })

  return window
}

function createServer (config) {
  var env = {}
  env['WEBVISUALSERVER'] = JSON.stringify(config)
  env.NODE_ENV = 'production'
  server = null
  server = fork( __dirname + '/node_modules/webvisual-server/index.js', [], { env: env })
  // console.log(config)
  server.on('message', (arg) => {
    if (window_main) {
      if (typeof arg === 'string' && arg === 'ready' && config)
        server.send( { connect: config } )
      else
        for (var type in arg) {
          window_main.webContents.send( type, arg[type] )
        }
    } else {
      console.log( arg[type] )
    }
  })
  server.on('error', function(error) {
    if (window_main) {
      window_main.webContents.send( "error", error.stack )
    } else {
      console.log( error.stack )
    }
  })
  server.on('exit', function() {
    console.log(`WEBVISUAL-SERVER (exit)`, ...arguments)
    if (activeErrorRestartJob) {
      clearTimeout(activeErrorRestartJob)
      activeErrorRestartJob = null
    }
    activeErrorRestartJob = setTimeout(() => {
      if (server && server.connected) {
        server.send( { disconnect: config } )
        server.kill()
      }
      createServer(config)
    }, 3000)
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  config.app.width = bounds.app.width
  config.app.height = bounds.app.height
  config.app.x = bounds.app.x
  config.app.y = bounds.app.y
  configLoader.save( config )

  // OS X
  if (process.platform != 'darwin') {
    app.quit()
  }
})

app.on('ready', () => {
  // Create the browser window.
  configLoader = new Settings(app)

  configLoader.on('error', (err) => {
    console.error('Error in AppConfig', err)
  })

  configLoader.on('ready', (msg, settings) => {
    config = settings
    console.log('ready')
    if (!window_main) {
      window_configfiles = createWindow(config, `file://${__dirname}/gui/settings.html`)
      window_main = createWindow(config, `file://${__dirname}/gui/main.html`)
    }
    // Autostart
    if (!server && process.argv[2] === 'start') {
      createServer(config)
    }
  })

  configLoader.on('change', (settings) => {
    config = settings
    if (server && server.send) {
      server.send( { reconnect: config } )
    }
  })

  // ipc beetween gui and process
  ipcMain.on('event', (e, event, arg) => {
    switch (event) {
      case 'ready':
        console.log = function() {
          window_main.webContents.send('log', util.format.apply(null, arguments) + '\n')
          process.stdout.write(util.format.apply(null, arguments) + '\n')
        }
        console.info = function() {
          window_main.webContents.send('info', util.format.apply(null, arguments) + '\n')
          process.stdout.write(util.format.apply(null, arguments) + '\n')
        }
        console.warn = function() {
          window_main.webContents.send('warn', util.format.apply(null, arguments) + '\n')
          process.stdout.write(util.format.apply(null, arguments) + '\n')
        }
        console.error = function() {
          window_main.webContents.send('error', util.format.apply(null, arguments) + '\n')
          process.stdout.write(util.format.apply(null, arguments) + '\n')
        }

        window_main.webContents.send('event', 'set-user-config', config.userConfigFiles)
        window_main.webContents.send('event', 'set-database', config.database)
        window_main.webContents.send('event', 'set-server-config', config.server)

        window_configfiles.webContents.send('set', {title: 'Servereinstellungen', schema: require('./defaults/schema/server.json')});
        break
      case 'server-start':
        if (server && server.send) {
          if (activeErrorRestartJob) {
            clearTimeout(activeErrorRestartJob)
            activeErrorRestartJob = null
          }
          server.send( { connect: config } )
        } else {
          createServer(config)
        }
        break
      case 'server-restart':
        if (server && server.send) {
          if (activeErrorRestartJob) {
            clearTimeout(activeErrorRestartJob)
            activeErrorRestartJob = null
          } else {
            server.send( { reconnect: config } )
          }
        } else {
          createServer(config)
        }
        break
      case 'server-stop':
        if (server && server.send) {
          server.send( { disconnect: {} } )
        }
        if (activeErrorRestartJob) {
          clearTimeout(activeErrorRestartJob)
          activeErrorRestartJob = null
        }
        break
      case 'server-toggle':
        if (server && server.send) {
          if (activeErrorRestartJob) {
            clearTimeout(activeErrorRestartJob)
            activeErrorRestartJob = null
            server.send( { disconnect: {} } )
          } else {
            server.send( { toggle: config } )
          }
        } else {
          createServer(config)
        }
        break
      case 'file-dialog':
        dialog.showOpenDialog({
          properties: ['openFile'],
          filters: arg.filter
        }, (files) => {
          sendPath(files, arg)
        })
        break
      case 'folder-dialog':
        dialog.showOpenDialog({
          properties: ['openDirectory']
        }, (folder) => {
          sendPath(folder, arg)
        })
        break
      case 'add-user-config':
        console.log(arg)
        addConfigFile(arg)
        break
      case 'remove-user-config':
        removeConfigFile(arg)
        break
      case 'set-server-config':
        configLoader.setEntry({
          server: arg
        })
        break
      case 'set-database':
        configLoader.setEntry({
          database: arg
        })
        break
    }
  })
})

// addConfigFile
function sendPath(files, arg) {
  window_main.webContents.send('event', 'file-dialog', {
    for: arg.for,
    path: (files && files.length > 0) ? files[0] : ''
  })
}

function addConfigFile(arg) {
  if (!arg.name || !arg.title || !arg.path)
    return

  config.userConfigFiles = config.userConfigFiles || []

  for (var i = 0; i < config.userConfigFiles.length; i++) {
    if (config.userConfigFiles[i].name === arg.name || config.userConfigFiles[i].path === arg.path) {
      config.userConfigFiles[i].name = arg.name
      config.userConfigFiles[i].title = arg.title
      config.userConfigFiles[i].path = arg.path
      configLoader.set(config)
      window_main.webContents.send('event', 'set-user-config', config.userConfigFiles)
      break
    }
  }

  config.userConfigFiles.push({
    name: arg.name,
    title: arg.title,
    path: arg.path
  })
  configLoader.set(config)
  window_main.webContents.send('event', 'set-user-config', config.userConfigFiles)

}

function removeConfigFile(arg) {
  if (!config.userConfigFiles) {
    config.userConfigFiles = []
  }
  if (arg.name) {
    let pos
    for (var i = 0; i < config.userConfigFiles.length; i++) {
      if (config.userConfigFiles[i].name === arg.name) {
        pos = i
        break
      }
    }
    config.userConfigFiles.splice(pos, 1)
    configLoader.set(config)
    window_main.webContents.send('event', 'set-user-config', config.userConfigFiles)
  }
}

/*
 * Handle process events
 */

process.on('uncaughtException', (err) => {
  console.log(`WEBVISUAL GUI (uncaughtException)\n ${err}`)
  if (activeErrorRestartJob) {
    clearTimeout(activeErrorRestartJob)
    activeErrorRestartJob = null
  }
  activeErrorRestartJob = setTimeout(() => {
    if (server) {
      server.send( { disconnect: config } )
      server.kill()
    }
    createServer(config)
  }, 3000)
})

process.on('ECONNRESET', (err) => {
  console.log(`WEBVISUAL GUI (ECONNRESET)\n ${err}`)
  if (activeErrorRestartJob) {
    clearTimeout(activeErrorRestartJob)
    activeErrorRestartJob = null
  }
  activeErrorRestartJob = setTimeout(() => {
    if (server) {
      server.send( { reconnect: config } )
    } else {
      createServer(config)
    }
  }, 3000)
})

process.on('SIGINT', (err) => {
  console.log(`WEBVISUAL GUI (SIGINT)\n ${err}`)
  process.exit(0)
})

process.on('exit', (err) => {
  console.log(`WEBVISUAL GUI (EXIT)\n ${err}`)
})
