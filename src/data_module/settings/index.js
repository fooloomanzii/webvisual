"use strict";

// EventEmitter types
//    "ready"
//    "saved"
//    "test-error"
//    "file-error"


var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var dataFileHandler = require('./../filehandler').dataFileHandler;

var defaults = {
  values: [{
    x: new Date(),
    y: 0,
    exceeds: null
  }]
};

class fileConfigLoader extends EventEmitter {

  constructor(userConfigFiles) {

    super();
    this.files = {};
    // check User Data and folder
    var self = this;

    for (var name in userConfigFiles) {
      this.files[name] = {};
      this.files[name]._path = path.resolve(userConfigFiles[name].path);

      this.files[name]._rawConfig = {};

      this.files[name]._filehandler = new dataFileHandler({
        id: name,
        connection: {
          file: {
            "mode": "json",
            "path": this.files[name]._path,
            "process": JSON.parse
          }
        },
        listener: {
            error: function(type, errors, name, path) {
              // console.log(errors);
              // this.emit('error', 'Error parsing ConfigFile... ', errors, path, name);
            },
            data: function(type, data, name, path) {
              self.files[name]._rawConfig = data;
              // console.log(type, data, name, path);
            }
        }
      });

      this.files[name]._filehandler.connect();
    }

    //   readFromFile
    //
    // }
    // filePath = path.join(appUserDataFolder, 'config', 'appConfig.json');
    //
    // this.load(filePath);
    //
    // var filePath = path.join(app.getPath('userData'), 'config', 'appConfig.json');
    //
    // this.loadAppConfig(filePath, this.loadAppConfig);
    //
    // this.on("error", function(err) {
    //   console.log('Error in Config', err);
    // })
    //
    // this._test(filepath);
    // if (!filepath) {
    //   this.emit('error', "No Filepath given");
    //   return;
    // }
    //
    // let rawConfig = this._readFromFile(filepath);
    //
    // let configuration = {
    //   elements: {},
    //   groups: {},
    //   groupingKeys: {},
    //   preferedGroupingKeys: {},
    //   labels: [],
    //   valueType: {},
    //   svg: rawConfig.svg
    // };
    //
    // let dataConfig = {};
    // let connection = {};
    //
    // for (let label in rawConfig.configurations) {
    //   configuration.labels.push(label);
    //   configuration.valueType[label] = rawConfig.configurations[label].valueType || defaults.value;
    //
    //   dataConfig[label] = this._arrange(label, rawConfig.configurations[label].locals, configuration.valueType[label],
    //     configuration.svg);
    //
    //   configuration.groupingKeys[label] = dataConfig[label].groupingKeys;
    //   configuration.preferedGroupingKeys[label] = dataConfig[label].preferedGroupingKey;
    //   configuration.groups[label] = dataConfig[label].groups;
    //   configuration.elements[label] = dataConfig[label].elements;
    //   configuration.valueType[label] = dataConfig[label].valueType;
    //   configuration.svg = dataConfig[label].svg;
    //
    //   connection[label] = rawConfig.configurations[label].connections;
    // }
    //
    // this.configuration = configuration;
    // this.dataConfig = dataConfig;
    // this.connection = connection;
  }

  load(filePath) {
    return this.testAccess(filePath, this.readFromFile.bind(this));

            this.loadDefaults(this.ready);
  }

  testAccess(filePath, callback) {
    return fs.access(filePath, fs.F_OK, (function(err) {
      if (!err) {
        try {
          this.testRead(filePath);
        } catch (e) {
          this.emit('error', 'Error parsing ConfigFile... ', e);
          return false;
        }
      }
      if (err) {
        return false;
      }
      else if (callback) {
        callback.call(this, filePath, this.ready);
      }
      return true;
    }).bind(this));
  };

  testRead(filePath) {
    JSON.parse(fs.readFileSync(filePath));
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
  }

  save(config) {
    let data = config || this.settings;
    try {
      this.testConfig(data);
    } catch (err) {
      this.emit('error', 'Error in AppConfig', err);
      return;
    }
    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.log('Error saving AppConfig:', err);
        this.emit('error', 'Error saving AppConfig:', err);
        return;
      }
    });
    console.log('AppConfig saved to file:', filePath);
    this.emit('saved', 'AppConfig saved to file:', filePath);
  }

  loadDefaults(callback) {
    this.mkdirp(path.join(appUserDataFolder, 'config'));
    this.copyFile(path.join(__dirname, 'defaults', 'appConfig.json'),
                  filePath,
                  function(err) {
                    if (err) this.emit('error', 'Error copying Defaults', err);
                  });
    this.readFromFile.call(this, path.join(__dirname, 'defaults', 'appConfig.json'), callback);
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
      return callback.call(this, obj)
    }
    else
      return obj || {};
  };

  _arrange(label, locals, valueType, svg) {

    if (!locals || !locals.types)
      return; // Check the Existence

    var types = [];
    var ids = [];
    var elements = {};
    var type;
    var keys = Object.keys(locals.unnamedType.keys);

    // all defined types are processed
    for (var i = 0; i < locals.types.length; i++) {
      // ignored if set in locals.ignore
      if (locals.ignore && locals.ignore.indexOf(i) == -1) {
        type = locals.types[i] || {};
        // if keys don't exist in locals
        if (!type.keys)
          type.keys = {};
        for (var j = 0; j < keys.length; j++) {
          type.keys[keys[j]] = type.keys[keys[j]] || locals.unnamedType.keys[keys[j]];
        }
        // isBoolean
        if (type.isBoolean === undefined)
          type.isBoolean = false;
        // label
        type.label = label;
        // isExceeding
        type.isExceeding = false;
        // lastExceeds
        type.lastExceeds = [];
        // lastExceeds
        type.firstExceeds = [];
        // id has to be different from unnamedType
        if (type.id == locals.unnamedType.id)
          type.id += i;
        // for Element structure
        elements[type.id] = type;
        // initial Values
        // type.values = valueType;
        types.push(type);
        ids.push(type.id);
      }
    }

    // GROUPING

    var groups = locals.exclusiveGroups;
    var needToSet, where;
    var groupingKeys = locals.groupingKeys;

    if (groupingKeys.indexOf('*') == -1) {
      groupingKeys.push('*'); // all elements
    }
    var preferedGroupingKey = locals.preferedGroupingKey || groupingKeys[0];

    for (var id in elements) {
      for (var key of groupingKeys) {
        if (!groups[key])
          groups[key] = {};

        needToSet = true;
        where = (key === "*" ? "*" : elements[id].keys[key] || "");

        for (var subgroup in groups[key])
          if (groups[key][subgroup].ids.indexOf(id) !== -1) {
            needToSet = false;
            break;
          }

        if (needToSet) {
          if (!groups[key][where])
            groups[key][where] = {};
          if (!groups[key][where].ids)
            groups[key][where].ids = [];
          groups[key][where].ids.push(id);
        }
      }
    }
    // Setting SVG for Groups
    var sameSource, source, selectable;
    for (var group in groups) {
      for (var subgroup in groups[group]) {
        source = '';
        selectable = {};
        sameSource = true;
        for (var id of groups[group][subgroup].ids) {
          if (elements[id] && elements[id].svg && elements[id].svg.source) {
            if (source && source !== elements[id].svg.source) {
              sameSource = false;
              break;
            } else {
              source = elements[id].svg.source;
              if (elements[id].svg.path)
                selectable[id] = elements[id].svg.path;
            }
          }
        }
        if (sameSource && svg[source]) {
          var initial = '';
          for (var id in selectable) {
            initial += selectable[id] + ',';
          }
          initial = initial.slice(0, -1);
          groups[group][subgroup].svg = {
            source: source,
            selectable: selectable,
            initial: initial
          }
        }
      }
    }

    // Setting Global SVG-Selectables
    for (var id in elements) {
      if (elements[id] && elements[id].svg && elements[id].svg.source) {
        source = elements[id].svg.source
        if (svg[source]) {
          if (!svg[source].selectable)
            svg[source].selectable = {};
          if (elements[id].svg.path)
            svg[source].selectable[id] = elements[id].svg.path;
        }
      }
    }

    return {
      label: label,
      types: types,
      ids: ids,
      groups: groups,
      elements: elements,
      groupingKeys: locals.groupingKeys,
      preferedGroupingKey: preferedGroupingKey,
      keys: keys,
      unnamedType: locals.unnamedType,
      timeFormat: locals.timeFormat,
      ignore: locals.ignore,
      svg: svg
    };
  };

  _test(filepath) {};

};

module.exports = fileConfigLoader;
