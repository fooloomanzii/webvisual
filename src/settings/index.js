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
      "ca": "./defaults/ssl/ca",
      "cert": "./defaults/ssl/ca.crt",
      "key": "./defaults/ssl/ca.key",
      "passphrase": "./defaults/ssl/ca.pw.json"
    }
  },
  "app": {
    "width": 480,
    "height": 640,
    "autoHideMenuBar": true,
    "acceptFirstMouse": true,
    "webPreferences": {
      "webSecurity": true
    },
    "x": 200,
    "y": 100
  },
  "userConfigFiles": [
    {
      "name": "Demo",
      "title": "Demo",
      "path": "./examples/config/test.json"
    }
  ],
  "database": {
    "type": "redis",
    "port": 6379,
    "host": "localhost",
    "maxCount": 3600 * 24 * 3
  }
}

class configLoader extends EventEmitter {

  constructor(app, configFilePathName = 'config') {

    super();
    // check User Data and folder
    this.userDataFolder = app.getPath('userData');
    this.configFilePathName = configFilePathName;
    this.configFilePath = path.join(this.userDataFolder, 'config', configFilePathName, '.json');

    this.load(this.configFilePath);
  }

  load(configFilePath) {
    this.testAccess(configFilePath, this.readFromFile.bind(this));
  }

  ready(settings) {
    var err;
    try {
      this.testConfig(settings);
    } catch(e) {
      err = e
    } finally {
      if (err) {
        this.emit('error', 'Error in Loaded Config: ' + err.stack)
        this.loadBackup(this.ready.bind(this));
      }
      else {
        this.settings = settings;
        this.emit('ready', 'AppConfigFile loaded: ' + this.configFilePath, this.settings);
        this.saveBackup(this.settings);
      }
    }
  }

  testAccess(configFilePath, callback) {
    return fs.access(configFilePath, fs.F_OK, (function(err) {
      if (!err) {
        try {
          this.testRead(configFilePath);
        } catch (e) {
          this.emit('error', '\nError parsing AppConfigFile. Loading Backup Settings ... \n' + e.stack);
          err = true;
        }
      }
      if (err) {
        this.loadBackup(this.ready.bind(this));
      }
      else if (callback) {
        callback.call(this, configFilePath, this.ready);
      }
    }).bind(this));
  };

  testRead(configFilePath) {
    JSON.parse(fs.readFileSync(configFilePath));
  }

  testConfig(config, callback) {
    JSON.parse(JSON.stringify(config));

    let missing = [];
    for (var opt in defaults) { // using defaults, if toplevel entry not as expected
      if (!config.hasOwnProperty(opt) || (config[opt] && (Array.isArray(defaults[opt]) !== Array.isArray(config[opt])))) {
        missing.push(opt)
        config[opt] = defaults[opt];
      }
    }
    if (!callback && missing.length > 0)
      throw {
        name: "MissingArgumentsError",
        message: "\nIn config are missing entries: " + missing.toString(),
        toString: function() { return this.name + ": " + this.message; }
      };
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
      this.emit('error', '\nError in AppConfig:\n' + err.stack);
      return;
    }
    fs.writeFile(this.configFilePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('\nError saving AppConfig:', err.stack);
        this.emit('error', '\nError saving AppConfig:\n' + err.stack);
        return;
      }
    });
    console.log('\nAppConfig saved to file:', this.configFilePath);
    this.emit('saved', '\nAppConfig saved to file:', this.configFilePath);
  }

  saveBackup(config) {
    let data = config || this.settings;

    try {
      this.testConfig(data);
    } catch (err) {
      this.emit('error', '\nError saving AppConfig:\n' + err.stack);
      return;
    }
    fs.writeFile( path.join(this.userDataFolder, 'config', this.configFilePathName + '.backup.json'), JSON.stringify(data, null, 2), err => {
      if (err) {
        console.log('Error saving DefaultAppConfig:', err.stack);
        this.emit('error', 'Error saving DefaultAppConfig:', err.stack);
        return;
      }
    });
  }

  loadBackup(callback) {
    mkdirp(path.join(this.userDataFolder, 'config'));

    this.copyFile( path.join(this.userDataFolder, 'config', this.configFilePathName + '.backup.json'),
                  this.configFilePath,
                  (function(err) {
                    if (err) {
                      this.emit('error', '\nError copying Backup', err.stack);
                      callback.call(this, defaults);
                      return;
                    }
                  }).bind(this));
    this.readFromFile.call(this, path.join(this.userDataFolder, 'config', this.configFilePathName + '.backup.json'), this.testConfig, callback);
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

  readFromFile(filepath, callback, next) {
    var obj;
    try {
      var file = fs.readFileSync(filepath)
      obj = JSON.parse(file);
    } catch (err) {
      this.emit('error', '\nReading File Failed: ', filepath,'\n', err.stack)
      return {};
    }
    if (callback) {
      callback.call(this, obj, next)
    }
    else
      return obj || {};
  };

};

module.exports = configLoader;
