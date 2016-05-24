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

var defaults = {
  values: [{
    x: new Date(),
    y: 0,
    exceeds: null
  }]
};

class configLoader extends EventEmitter {

  constructor(filepath, app) {

    super();
    // console.log(app.getPath('userData'));
    this.on("error", function(err) {
      console.log('Error in Config', err);
    })

    this._test(filepath);
    if (!filepath) {
      this.emit('error', "No Filepath given");
      return;
    }

    let rawConfig = this._readFromFile(filepath);

    let config = {
      groupingKeys: {},
      structure: {},
      preferedGroupingKeys: {},
      labels: [],
      svg: rawConfig.svg,
      svgElements: {},
      svgGroups: {},
      captions: {}
    };

    let dataConfig = {};
    let connection = {};

    for (let label in rawConfig.configurations) {
      config.labels.push(label);
      dataConfig[label] = this._arrange(label, config.labels.indexOf(label), rawConfig.configurations[label].locals);

      config.groupingKeys[label] = dataConfig[label].groupingKeys;
      // config.paths[label] = dataConfig[label].paths;
      config.preferedGroupingKeys[label] = dataConfig[label].preferedGroupingKey;
      config.structure[label] = dataConfig[label].groups;
      config.svgGroups[label] = dataConfig[label].svgGroups;
      config.svgElements[label] = dataConfig[label].svgElements;
      config.captions[label] = dataConfig[label].captions;
      connection[label] = rawConfig.configurations[label].connections;
    }

    console.log(config.svgGroups['test']);
    this.configuration = config;
    this.dataConfig = dataConfig;
    this.connection = connection;
    this.port = rawConfig.port;
    this.mail = rawConfig.mail;
    this.auth = rawConfig.auth;
    this.logs = rawConfig.svg;
  }

  loadAppConfig() {

  };

  writeAppConfig(config) {

  };

  loadUserConfig(filepath) {

  };

  writeUserConfig(config, targetpath) {

  };

  initUserDefaults() {

  };

  initDefaults() {

  };


  _readFromFile(filepath) {
    var obj;
    try {
      var file = fs.readFileSync(filepath)
      obj = JSON.parse(file);
    } catch (err) {
      this.emit("error", err)
      console.log("Config File", filepath, err);
      return {};
    }
    return obj || {};
  };

  _arrange(label, labelindex, locals) {

    if (!locals || !locals.types)
      return; // Check the Existence

    var types = [];
    var ids = [];
    var type;
    var keys = Object.keys(locals.unnamedType.keys);

    // all defined types are processed
    for (var i = 0; i < locals.types.length; i++) {
      // ignored if set in locals.ignore
      if (locals.ignore && locals.ignore.indexOf(i) == -1) {
        type = locals.types[i] || {};

        // if types of values is not an Array or doesn't exist then use the default
        if (!type.values || !Array.isArray(type.values))
          type.values = defaults.values;

        // if keys don't exist in locals
        if (!type.keys)
          type.keys = {};
        for (var j = 0; j < keys.length; j++) {
          type.keys[keys[j]] = type.keys[keys[j]] || locals.unnamedType.keys[keys[j]];
        }
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
        types.push(type);
        ids.push(type.id);
      }
    }

    // GROUPING
    // note:      this speeds up client handling of grouping, and could save transmitted
    //            data initially
    // structure: groups: [{ key: '---',
    //                       subgroups: [ { name: '---'
    //                                      elements: [ {id = '---', ...}, ...]
    //                                      ids: [ '---', ....]
    //                                    },...]
    //                     },...]
    // initialy set the preferedGroups
    var groups = locals.exclusiveGroups;
    var key, where, source, initial, name, path;
    var svgElements = {},
      svgGroups = {};

    var groupingKeys = locals.groupingKeys;
    if (groupingKeys.indexOf('all') == -1) {
      groupingKeys.push('all');
    }
    var preferedGroupingKey = locals.preferedGroupingKey || groupingKeys[0];

    for (var i = 0; i < types.length; i++) {
      for (var j = 0; j < groupingKeys.length; j++) {
        key = groupingKeys[j];
        if (!groups[key])
          groups[key] = {};

        where = types[i].keys[key];

        for (var subgroup in groups[key])
          if (Object.keys(groups[key][subgroup]).indexOf(types[i].id) !== -1) {
            where = subgroup;
            break;
          }

        if (!groups[key][where])
          groups[key][where] = {};

        groups[key][where][types[i].id] = types[i];

        if (types[i].svg)
          svgElements[types[i].id] = types[i].svg;
      }
    }

    var sameSource, source, selectable;
    for (var group in groups) {
      svgGroups[group] = {};
      for (var subgroup in groups[group]) {
        source = '';
        selectable = {};
        sameSource = true;
        for (var id in groups[group][subgroup]) {
          if (svgElements[id] && svgElements[id].source) {
            if (source && source !== svgElements[id].source) {
              sameSource = false;
            } else {
              source = svgElements[id].source;
              selectable[id] = svgElements[id].path;
            }
          }
        }
        if (sameSource) {
          svgGroups[group][subgroup] = {
            source: source,
            selectable: selectable
          }
        }
      }
    }

    return {
      label: label,
      types: types,
      ids: ids,
      groups: groups,
      groupingKeys: locals.groupingKeys,
      preferedGroupingKey: preferedGroupingKey,
      keys: keys,
      unnamedType: locals.unnamedType,
      timeFormat: locals.timeFormat,
      ignore: locals.ignore,
      svgGroups: svgGroups,
      svgElements: svgElements
    };
  };

  _test(filepath) {};

};

module.exports = configLoader;
