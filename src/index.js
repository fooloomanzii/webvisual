// require('events').EventEmitter.prototype._maxListeners = 0
process.env.NODE_ENV = 'production'

const fs = require('fs'),
      path = require('path'),
      util = require('util'),
      mergeOptions = require('merge-options');

const { dialog, ipcMain, app, BrowserWindow } = require('electron')
const fork = require('child_process').fork
const Settings = require('./settings')
const schema = require('webvisual-schemas')

const WINDOW_DEFAULTS = {
  autoHideMenuBar: true,
  acceptFirstMouse: true,
  center: true,
  width: 600,
  webPreferences: {
    nodeIntegration: true,
    webSecurity: true
  }
}
const USER_CONFIG_FOLDER = path.join( app.getPath('userData'), 'config' )
const USER_DATA_FOLDER = app.getPath('userData')
const APP_CONFIGS = ['server', 'database', 'configfiles']

// change RAM-limit
app.commandLine.appendSwitch("js-flags", "--max_old_space_size=6000")

let server
let configHandler = new Map()

let config = {}
  , activeRestartJob
  , window_main
  , modal
  , window_bounds = {};

function createWindow (conf = {}, url, firstSendEvents = []) {
  // Create the browser window.
  // config = mergeOptions(config, WINDOW_DEFAULTS)
  title = conf.title || 'app'
  var window = new BrowserWindow(mergeOptions(conf, WINDOW_DEFAULTS))

  // and load the main.html of the app.
  window.loadURL(url)

  // Open the DevTools.
  // window.openDevTools()

  return window
}

function createServer(config) {
  if (server && server.send) {
    server.send( { disconnect: config } )
    server.kill()
    server = null
  }
  var env = {}
  env['WEBVISUALSERVER'] = JSON.stringify(config)
  env.NODE_ENV = 'production'
  server = fork( __dirname + '/node_modules/webvisual-server/index.js', [], { env: env })
  // console.log(config)
  server.on('message', (arg) => {
    if (typeof arg === 'string' && arg === 'ready' && config)
      server.send( { connect: config } )
    else if (window_main) {
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
    console.log(`WEBVISUAL-SERVER (EXIT)`, ...arguments)
    startServer(config, true)
  })
}

function startServer(config, kill) {
  if (activeRestartJob) {
    clearTimeout(activeRestartJob)
    activeRestartJob = null
  }
  if (!kill && server && server.send) {
    activeRestartJob = setTimeout(() => {
      server.send( { reconnect: config } )
    }, 3000)
  } else {
    activeRestartJob = setTimeout(() => {
      createServer(config)
    }, 3000)
  }
}

function stopServer(config, kill) {
  if (activeRestartJob) {
    clearTimeout(activeRestartJob)
    activeRestartJob = null
  }
  if (server && server.send) {
    server.send( { disconnect: config } )
    if (kill) {
      server.kill()
      server = null
    }
  }
}

// Quit when all modals are closed.
app.on('window-all-closed', () => {
  configHandler.forEach( (ch, name) => {
    ch.save(config[name]);
  })

  // OS X
  if (process.platform != 'darwin') {
    app.quit()
  }
})

app.on('ready', () => {
  // Create the browser window.

  APP_CONFIGS.forEach( name => {
    configHandler.set(name,
      new Settings(USER_CONFIG_FOLDER, name, '.json', schema[name])
        .on('ready', settings => {
          console.error(`Config loaded (${name})`)
          config[name] = settings

          let shouldStart = true
          for (let i = 0; i < APP_CONFIGS.length; i++) {
            if (!config.hasOwnProperty(APP_CONFIGS[i])) {
              shouldStart = false;
              break;
            }
          }

          if (shouldStart) {
            if (!window_main) {
              window_main = createWindow({title: 'Webvisual'}, `file://${__dirname}/gui/main.html`).
              on('close', () => {
                if (modal) {
                  modal.close();
                }
              })
            }
            // Autostart
            if (process.argv[2] === 'start') {
              startServer(config)
            }
          }
        })
        .on('change', settings => {
          console.error(`Config changed (${name})`)
          config[name] = settings
          if (server && server.send) {
            server.send( { reconnect: config } )
          }
        })
        .on('error', err => {
          console.error(`Error in ${name} config`, err)
        })
      )
  })

  configHandler.get('server').on('ready', settings => {
    settings._tmpDir = path.join(USER_DATA_FOLDER, 'tmp')
    config.server = settings
  })

  // ipc beetween gui and process
  ipcMain.on('event', (e, event, arg, arg2) => {
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
        // window_configfiles.webContents.send('set', {title: 'Servereinstellungen', schema: require('./defaults/schema/server.json')});
        break
      case 'server-start':
      case 'server-toggle':
      case 'server-restart':
        startServer(config)
        break
      case 'server-stop':
        stopServer(config)
        break
      case 'edit-config':
        if (typeof arg !== 'string') {
          return
        }
        modal = new BrowserWindow({parent: window_main, title: 'Einstellungen', width: 400, modal: true, fullscreenable: false, type: 'toolbar', show: false, autoHideMenuBar: true})
        modal.loadURL(`file://${__dirname}/gui/settings.html`)
        modal.once('ready-to-show', () => {
          modal.webContents.send('set', schema[arg], config[arg], arg)
          modal.show()
        })
        modal.on('close', () => {
          modal = null;
        })
        break
      case 'set-config':
        if (typeof arg !== 'string') {
          return
        }
        config[arg] = arg2
        if (configHandler && configHandler.has(arg)) {
          configHandler.get(arg).save(arg2)
        }
        if (server && server.send) {
          server.send( { reconnect: config } )
        }
        break
      case 'get-config':
        if (!modal || typeof arg !== 'string') {
          return
        }
        modal.webContents.send('set', schema[arg], config[arg], arg)
        break
      case 'close':
        if (modal) {
          modal.close();
        }
        break
    }
  })
})

/*
 * Handle process events
 */

process.on('uncaughtException', err => {
  console.log(`WEBVISUAL GUI (uncaughtException)\n ${err}`)
  startServer(config, true)
})

process.on('ECONNRESET', err => {
  console.log(`WEBVISUAL GUI (ECONNRESET)\n ${err}`)
  startServer(config, true)
})

process.on('SIGINT', err => {
  console.log(`WEBVISUAL GUI (SIGINT)\n ${err}`)
  process.exit(0)
})

process.on('exit', err => {
  console.log(`WEBVISUAL GUI (EXIT)\n ${err}`)
})
