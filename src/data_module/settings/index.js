"use strict";

// EventEmitter types
//    "changed"
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
    this.settings = {};
    if (userConfigFiles)
      this.watch(userConfigFiles);
  }

  watch(userConfigFiles) {
    // check User Data and folder
    let listener;
    for (var name in userConfigFiles) {
      this.settings[name] = {};
      this.settings[name]._path = path.resolve(userConfigFiles[name].path);
      if(this.settings[name]._filehandler)
        this.settings[name]._filehandler.close();
      listener = {
        error: (function(type, errors, name, path) {
          // console.log(errors);
          this.emit('error', errors, {path, name});
        }).bind(this),
        data: (function(type, data, name, path) {
          if (data && name) {
            this.access(name, data);
          }
        }).bind(this)
      }
      this.settings[name]._filehandler = new dataFileHandler({
        id: name,
        connection: {
          file: {
            "mode": "json",
            "path": this.settings[name]._path,
            "process": JSON.parse
          }
        },
        listener: listener
      });
      this.settings[name]._filehandler.connect();
    }
  }

  unwatch() {
    for (var name in this.settings) {
      this.settings[name]._filehandler.close();
      delete this.settings[name]._filehandler;
      delete this.settings[name]._path;
      delete this.settings[name].configuration;
      delete this.settings[name].dataConfig;
      delete this.settings[name].connection;
    }
  }

  access(name, data, callback) {
    let err;
    try {
      let configuration = {
        elements: {},
        groups: {},
        groupingKeys: {},
        preferedGroupingKeys: {},
        labels: [],
        valueType: {},
        svg: {}
      };

      if (this.settings[name].configuration)
        configuration.labels = this.settings[name].configuration.labels || {};

      let dataConfig = {};
      let connection = {};

      for (let label in data) {
        if (configuration.labels.indexOf(label) === -1)
          configuration.labels.push(label);
        configuration.valueType[label] = data[label].valueType || defaults.value;

        dataConfig[label] = this._arrange(
          label, data[label].locals, configuration.valueType[label], data[label].svg);

        configuration.groupingKeys[label] = dataConfig[label].groupingKeys;
        configuration.preferedGroupingKeys[label] = dataConfig[label].preferedGroupingKey;
        configuration.groups[label] = dataConfig[label].groups;
        configuration.elements[label] = dataConfig[label].elements;
        configuration.valueType[label] = dataConfig[label].valueType;
        configuration.svg[label] = dataConfig[label].svg;

        connection[label] = data[label].connections;
      }
      this.settings[name].configuration = configuration;
      this.settings[name].dataConfig = dataConfig;
      this.settings[name].connection = connection;
    } catch (e) {
      err = e;
      console.log(e);
    } finally {
    if(!err)
      this.emit('changed', name);
    }

  }

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
        // Unit
        if (!type.unit)
          type.unit = '';
        // isBoolean
        if (!type.isBoolean)
          type.isBoolean = false;
        // color
        if (!type.color)
          type.color = '';
        // label
        type.label = label;
        // isExceeding
        type.isExceeding = false;
        // lastExceeds
        type.lastExceeds = [];
        // lastExceeds
        type.firstExceeds = [];
        // id has to be different from unnamedType
        if (type.id === locals.unnamedType.id)
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
        else if (groups[key].ids)
          groups[key].ids = groups[key].ids.filter(function(el) { el in ids } );


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
        sameSource = true;
        for (var id of groups[group][subgroup].ids) {
          if (elements[id] && elements[id].svg && elements[id].svg.source) {
            if (source && source !== elements[id].svg.source) {
              sameSource = false;
              break;
            } else {
              source = elements[id].svg.source;
            }
          }
        }
        if (sameSource && svg && svg[source]) {
          groups[group][subgroup].svg = {
            source: source
          }
        }
      }
    }

    // Setting Global SVG-Selectables
    if (svg)
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
