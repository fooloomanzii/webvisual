'use strict';

// EventEmitter types
//    'ready'
//    'saved'
//    'test-error'
//    'file-error'

const fs = require('fs')
    , path = require('path')
    , util = require('util')
    , EventEmitter = require('events').EventEmitter
    , mergeDeep = require('merge-defaults')
    , mkdirp = require('mkdirp');

var appConfigFilePath;
var appUserDataFolder;
var app;

const defaults = {
  "server": {
    "auth": {
      "required": false,
      "ldap": {
        "baseDN": "dc=ibn-net,dc=kfa-juelich,dc=de",
        "url": "ldap://ibn-net.kfa-juelich.de"
      },
      "suffix": "@fz-juelich.de"
    },
    "port": 443,
    "ssl": {
      "cert": "",
      "key": "",
      "passphrase": ""
    }
  },
  "app": {
    "width": 576,
    "height": 692,
    "autoHideMenuBar": true,
    "acceptFirstMouse": true,
    "webPreferences": {
      "webSecurity": true
    },
    "x": 932,
    "y": 143
  },
  "userConfigFiles": [ ],
  "database": [
    {
      "name": "redis",
      "port": 6379,
      "url": "localhost"
    }
  ]
}

class configLoader extends EventEmitter {

  constructor(app) {

    super();
    // check User Data and folder
    appUserDataFolder = app.getPath('userData');
    appConfigFilePath = path.join(appUserDataFolder, 'config', 'appConfig.json');

    this.load(appConfigFilePath);
  }

  load(appConfigFilePath) {
    this.testAccess(appConfigFilePath, this.readFromFile.bind(this));
  }

  ready(settings) {
    var err;
    try {
      this.testConfig(settings);
    } catch(e) {
      err = true
    } finally {
      if (err)
        this.loadBackup(this.ready);
      else {
        this.settings = settings;
        this.emit('ready', 'AppConfigFile loaded: ' + appConfigFilePath, this.settings);
      }
    }
  }

  testAccess(appConfigFilePath, callback) {
    return fs.access(appConfigFilePath, fs.F_OK, (function(err) {
      if (!err) {
        try {
          this.testRead(appConfigFilePath);
        } catch (e) {
          this.emit('error', '\nError parsing AppConfigFile. Loading Backup Settings ... \n' + e);
          err = true;
        }
      }
      if (err) {
        this.loadBackup(this.ready);
      }
      else if (callback) {
        callback.call(this, appConfigFilePath, this.ready);
      }
    }).bind(this));
  };

  testRead(appConfigFilePath) {
    JSON.parse(fs.readFileSync(appConfigFilePath));
  }

  testConfig(config, callback) {
    JSON.parse(JSON.stringify(config));
    for (var opt in defaults) { // using defaults, if toplevel entry not as expected
      if (!config.hasOwnProperty(opt) || (config[opt] && Array.isArray(defaults[opt]) && !Array.isArray(config[opt]))) {
        config[opt] = defaults[opt]
      }
    }
    if (callback)
      callback(config);
  }

  set(config) {
    try {
      this.testConfig(config);
    } catch (err) {
      this.emit('error', '\nError in AppConfig:\n' + err);
      return;
    }
    this.settings = config;
    this.emit('change', config);
    this.saveBackup(this.settings);
  }

  setEntry(config) {
    this.settings = mergeDeep(config, this.settings);
    this.emit('change', this.settings);
    this.save(this.settings);
    this.saveBackup(this.settings);
  }

  save(config) {
    let data = config || this.settings;
    try {
      this.testConfig(data);
    } catch (err) {
      this.emit('error', '\nError in AppConfig:\n' + err);
      return;
    }
    fs.writeFile(appConfigFilePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('\nError saving AppConfig:', err);
        this.emit('error', '\nError saving AppConfig:\n' + err);
        return;
      }
    });
    console.log('\nAppConfig saved to file:', appConfigFilePath);
    this.emit('saved', '\nAppConfig saved to file:', appConfigFilePath);
  }

  saveBackup(config) {
    let data = config || this.settings;

    try {
      this.testConfig(data);
    } catch (err) {
      this.emit('error', '\nError saving AppConfig:\n' + err);
      return;
    }
    fs.writeFile(path.join(process.cwd(), 'defaults', 'appConfig.backup.json'), JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('Error saving DefaultAppConfig:', err);
        this.emit('error', 'Error saving DefaultAppConfig:', err);
        return;
      }
    });
  }

  loadBackup(callback) {
    mkdirp(path.join(appUserDataFolder, 'config'));
    this.copyFile(path.join(process.cwd(), 'defaults', 'appConfig.backup.json'),
                  appConfigFilePath,
                  (function(err) {
                    if (err) {
                      this.emit('error', '\nError copying Backup', err);
                      callback.call(this, defaults);
                      return;
                    }
                  }).bind(this));
    this.readFromFile.call(this, path.join(process.cwd(), 'defaults', 'appConfig.backup.json'), callback);
  }

  checkFolder(path_folder, callback) {
    fs.access(path, fs.F_OK, function(err) {
      if (!err) {
        // Do something
      } else {
        // It isn't accessible
      }
    });
  }

  copyFile(source, target, callback) {
    var callbackCalled = false;

    var rd = fs.createReadStream(source);
    rd.on('error', done);

    var wr = fs.createWriteStream(target);
    wr.on('error', done);
    wr.on('close', function(ex) {
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

  readFromFile(filepath, callback) {
    var obj;
    try {
      var file = fs.readFileSync(filepath)
      obj = JSON.parse(file);
    } catch (err) {
      this.emit('error', '\nReading File Failed: ', filepath,'\n', err)
      return {};
    }
    if (callback) {
      callback.call(this, obj)
    }
    else
      return obj || {};
  };

};

module.exports = configLoader;
