'use strict';

// EventEmitter types
//    'ready'
//    'saved'
//    'test-error'
//    'file-error'


var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var appConfigFilePath;
var appUserDataFolder;
var app;
var mergeDeep = require('merge-defaults');

var defaults = {
  values: [{
    x: new Date(),
    y: 0,
    exceeds: null
  }]
};

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
    this.settings = settings;
    if (settings)
      this.emit('ready', 'AppConfigFile loaded: ' + appConfigFilePath, this.settings);
  }

  testAccess(appConfigFilePath, callback) {
    return fs.access(appConfigFilePath, fs.F_OK, (function(err) {
      if (!err) {
        try {
          this.testRead(appConfigFilePath);
        } catch (e) {
          this.emit('error', 'Error parsing AppConfigFile. Copying Default Settings ... ', e);
          err = true;
        }
      }
      if (err) {
        this.loadAppDefaults(this.ready);
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
    if (callback)
      callback(config);
  }

  set(config) {
    try {
      this.testConfig(config);
    } catch (err) {
      this.emit('error', 'Error in AppConfig', err);
      return;
    }
    this.settings = config;
    this.emit('changed', config);
    this.save(this.settings);
  }

  setEntry(config) {
    this.settings = mergeDeep(this.settings, config);
    this.emit('changed', this.settings);
    this.save(this.settings);
  }

  save(config) {
    let data = config || this.settings;
    try {
      this.testConfig(data);
    } catch (err) {
      this.emit('error', 'Error in AppConfig', err);
      return;
    }
    fs.writeFile(appConfigFilePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('Error saving AppConfig:', err);
        this.emit('error', 'Error saving AppConfig:', err);
        return;
      }
    });
    console.log('AppConfig saved to file:', appConfigFilePath);
    this.emit('saved', 'AppConfig saved to file:', appConfigFilePath);
  }

  loadAppDefaults(callback) {
    this.mkdirp(path.join(appUserDataFolder, 'config'));
    this.copyFile(path.join(process.cwd(), 'defaults', 'appConfig.json'),
                  appConfigFilePath,
                  function(err) {
                    if (err) this.emit('error', 'Error copying Defaults', err);
                  });
    this.readFromFile.call(this, path.join(process.cwd(), 'defaults', 'appConfig.json'), callback);
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

  mkdirp(path, callback) {
    fs.mkdir(path, '0o777', function(err) {
      if (callback) callback(err);
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
      this.emit('Read Error:', err)
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
