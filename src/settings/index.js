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
    , mergeDeep = require('merge-options')
    , mkdirp = require('mkdirp');

class configLoader extends EventEmitter {

  constructor(folder, fileName, defaults) {

    super();
    // check User Data and folder
    this.defaults = defaults || {};
    this.folder = folder;
    this.fileName = fileName;
    this.filePath = path.join(this.folder, this.fileName);

    this.load(this.filePath);
  }

  load(filePath) {
    this.testAccess(filePath, this.readFromFile.bind(this, ...arguments));
  }

  ready(settings) {
    var err;
    try {
      this.testConfig(settings);
    } catch(e) {
      err = true
    } finally {
      if (err)
        this.loadBackup(this.ready.bind(this));
      else {
        this.settings = settings;
        this.emit('ready', 'AppConfigFile loaded: ' + this.filePath, this.settings);
        this.saveBackup(this.settings);
      }
    }
  }

  testAccess(filePath, callback) {
    return fs.access(filePath, fs.F_OK, (function(err) {
      if (!err) {
        try {
          this.testRead(filePath);
        } catch (e) {
          this.emit('error', '\nError parsing AppConfigFile. Loading Backup Settings ... \n' + e);
          err = true;
        }
      }
      if (err) {
        this.loadBackup(this.ready.bind(this));
      }
      else if (callback) {
        callback.call(this, filePath, this.ready);
      }
    }).bind(this));
  };

  testRead(filePath) {
    JSON.parse(fs.readFileSync(filePath));
  }

  testConfig(config, callback) {
    config = JSON.parse(JSON.stringify(config || {}));

    let missing = [];
    for (var opt in this.defaults) { // using defaults, if toplevel entry not as expected
      if (!config.hasOwnProperty(opt) || (config[opt] && (Array.isArray(this.defaults[opt]) !== Array.isArray(config[opt])))) {
        missing.push(opt)
        config[opt] = this.defaults[opt];
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
    this.settings = mergeOptions(config, this.settings);
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
    fs.writeFile(this.filePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('\nError saving AppConfig:', err);
        this.emit('error', '\nError saving AppConfig:\n' + err);
        return;
      }
    });
    console.log('\nAppConfig saved to file:', this.filePath);
    this.emit('saved', '\nAppConfig saved to file:', this.filePath);
  }

  saveBackup(config) {
    let data = config || this.settings;

    try {
      this.testConfig(data);
    } catch (err) {
      this.emit('error', '\nError saving AppConfig:\n' + err);
      return;
    }
    fs.writeFile(this.filePath + '.backup', JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('Error saving DefaultAppConfig:', err);
        this.emit('error', 'Error saving DefaultAppConfig:', err);
        return;
      }
    });
  }

  loadBackup(callback) {
    if (this.folder && this.filePath) {
      mkdirp(path.join(this.folder));
      this.copyFile(this.filePath + '.backup',
                    this.filePath,
                    err => {
                      if (err) {
                        this.emit('error', '\nError copying Backup', err);
                        callback.call(this, this.defaults);
                        return;
                      }
                      this.readFromFile.call(this, this.filePath + '.backup', this.testConfig, callback);
                    });
    } else {
      callback.call(this, this.defaults);
    }
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
      this.emit('error', '\nReading File Failed: ', filepath,'\n', err)
    }
    if (typeof callback === 'function') {
      callback.call(this, obj, next)
    } else if (typeof next === 'function') {
      next.call(this, obj)
    }
    else
      return obj || {};
  };

};

module.exports = configLoader;
