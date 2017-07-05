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
    , mergeOptions = require('merge-options')
    , mkdirp = require('mkdirp')
    , Ajv = require('ajv');

var ajv = new Ajv();

class configLoader extends EventEmitter {

  constructor(fileFolder, filePathName = 'config', fileExtension = '.json', schema = {}) {
    if (!(schema && typeof schema === 'object')) {
      throw new Error('Invalid schema for config')
    }
    super();
    // check User Data and folder
    this.fileFolder = fileFolder;
    this.filePathName = filePathName;
    this.fileExtension = fileExtension.startsWith('.') ? fileExtension : '.' + fileExtension;
    this.filePath = path.join(this.fileFolder, this.filePathName + this.fileExtension);
    this.schema = schema;
    this.defaults = this.schema.default;
    this.validate = ajv.compile(this.schema);

    this.load(this.filePath);
  }

  load(filePath) {
    this.testAccess(filePath, this.readFromFile.bind(this));
  }

  ready(config) {
    var err;
    try {
      this.testConfig(config);
    } catch(e) {
      err = e
    } finally {
      if (err) {
        this.emit('error', 'Error in Loaded Config: ' + err.stack)
        this.loadBackup(this.ready.bind(this));
      }
      else {
        if (typeof config === 'string') {
          this.settings = JSON.parse(config);
        } else if (typeof config === 'object') {
          this.settings = JSON.parse(JSON.stringify(config));
        }
        this.emit('ready', this.settings);
        this.save(this.settings, path.join(this.fileFolder, this.filePathName + '.backup' + this.fileExtension));
        this.save(this.settings, this.filePath);
      }
    }
  }

  testAccess(filePath, callback) {
    return fs.access(filePath, fs.F_OK, err => {
      if (!err) {
        try {
          var json = fs.readFileSync(filePath, {encoding:'utf8'});
          if (!json) {
            err = true;
          } else {
            JSON.parse(err);
          }
        } catch (e) {
          this.emit('error', '\nError parsing ConfigFile. Loading Backup Settings ... \n' + e.stack);
          err = true;
        }
      }
      if (err) {
        this.loadBackup(this.ready.bind(this));
      }
      else if (callback) {
        callback.call(this, filePath, this.ready);
      }
    });
  };

  testConfig(config, callback) {
    if (typeof config === 'string') {
      config = JSON.parse(config);
    } else if (typeof config === 'object') {
      config = JSON.parse(JSON.stringify(config));
    }
    if (!this.validate(config)) {
      console.error('Invalid Config "' + this.filePathName + '"')
    } else if (callback)
      callback(config);
  }

  set(config) {
    try {
      this.testConfig(config);
    } catch (err) {
      this.emit('error', '\nError in Config:\n' + err);
      return;
    }
    this.settings = config;
    this.emit('change', config);
    this.save(this.settings, path.join(this.fileFolder, this.filePathName + '.backup' + this.fileExtension));
  }

  setEntry(config) {
    this.validate(config);
    this.settings = mergeOptions(config, this.settings);
    this.emit('change', this.settings);
    this.save(this.settings);
    this.save(this.settings, path.join(this.fileFolder, this.filePathName + '.backup' + this.fileExtension));
  }

  save(config, path) {
    path = path || this.filePath;
    let data = config || this.settings;
    if (typeof data === 'object') {
      data = JSON.stringify(data)
    }

    fs.writeFile(path, data, (err) => {
      if (err) {
        console.log('\nError saving Config:', err.stack);
        this.emit('error', '\nError saving Config:\n' + err.stack);
        return;
      }
      console.log('\nConfig saved to file:', path);
    });
  }

  loadBackup(callback) {
    mkdirp(path.resolve(this.fileFolder));
    var backupPath = path.join(this.fileFolder, this.filePathName + '.backup' + this.fileExtension);
    var json;

    fs.access(backupPath, fs.F_OK, err => {
      if (!err) {
        try {
          json = fs.readFileSync(backupPath, {encoding:'utf8'});
          if (!json) {
            err = true;
          } else {
            JSON.parse(json);
          }
        } catch (e) {
          this.emit('error', '\nError parsing BackupFile. Loading Default Settings ... \n' + e.stack);
          err = true;
        }
      }
      if (err) {
        json = this.defaults;
      }
      if (callback) {
        callback.call(this, json);
      }
    });
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
      var file = fs.readFileSync(filepath, {encoding:'utf8'})
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
