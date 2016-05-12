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
      dataStructure: {},
      preferedGroupingKeys: {},
      labels: [],
      svg: rawConfig.svg
    };

    let dataConfig = {};
    let connection = {};

    for (let label in rawConfig.configurations) {
      config.labels.push(label);
      dataConfig[label] = this._arrange(label, config.labels.indexOf(label), rawConfig.configurations[label].locals,
        rawConfig.svg);

      config.groupingKeys[label] = dataConfig[label].groupingKeys;
      // config.paths[label] = dataConfig[label].paths;
      config.preferedGroupingKeys[label] = dataConfig[label].preferedGroupingKey;
      config.dataStructure[label] = dataConfig[label].groups;

      connection[label] = rawConfig.configurations[label].connections;
    }

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

  _arrange(label, labelindex, locals, svgSources) {

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

        for (var subgroup in groups[key]) {
          if (Object.keys(groups[key][subgroup]).indexOf(types[i].id) !== -1) {
            where = subgroup;
            break;
          }
        }

        //TODO: gebraucht wird ein extra Object für svg-Pfade der Gruppen



        // for (var k = 0; k < groups[l].subgroup.length; k++) {
        //   if (groups[l].subgroup[k].ids && (groups[l].subgroup[k].ids.indexOf(types[i].id)) != -1) {
        //     needToSetElement = false;
        //     if (!groups[l].subgroup[k].elements) {
        //       groups[l].subgroup[k].elements = [];
        //     }
        //     if (groups[l].subgroup[k].elements.indexOf(types[i]) == -1) {
        //       groups[l].subgroup[k].elements.push(types[i]);
        //     }
        //     where = k;
        //     break;
        //   }
        //   if (groups[l].subgroup[k].name == types[i].keys[key]) {
        //     where = k;
        //   } else if (key == 'all') {
        //     where = k;
        //   }
        // }
        if (!groups[key][where])
          groups[key][where] = {};

        groups[key][where][types[i].id] = types[i];

        // if (needToSetElement) {
        //   if (where == -1) {
        //     groups[l].subgroup.push({
        //       name: types[i].keys[key] || ((key == 'all') ? 'all' : ''),
        //       ids: [types[i].id],
        //       elements: [types[i]],
        //       svg: {
        //         source: "",
        //         initial: ""
        //       }
        //     });
        //   } else {
        //
        //     if (!groups[l].subgroup[where].elements)
        //       groups[l].subgroup[where].elements = [];
        //     if (!groups[l].subgroup[where].ids)
        //       groups[l].subgroup[where].ids = [];
        //
        //     groups[l].subgroup[where].elements.push(types[i]);
        //     groups[l].subgroup[where].ids.push(types[i].id);
        //   }
        // }
        //
        // // add svg paths and captions
        // if (where !== -1) {
        //   // set default if not set
        //   if (!groups[l].subgroup[where].svg)
        //     groups[l].subgroup[where].svg = {
        //       source: "",
        //       initial: ""
        //     };
        //
        //   // elements in groups in svg are selectable
        //   source = groups[l].subgroup[where].svg.source;
        //   initial = groups[l].subgroup[where].svg.initial;
        //   name = groups[l].subgroup[where].name;
        //
        //   if (name && source && svgSources[source]) {
        //
        //     if (!svgSources[source].selectable)
        //       svgSources[source].selectable = {};
        //     if (initial && !svgSources[source].selectable[name]) {
        //       svgSources[source].selectable[name] = {};
        //       svgSources[source].selectable[name] = {
        //         "path": initial,
        //         "caption": {
        //           "name": name
        //         }
        //       };
        //     }
        //     // add elements path
        //     if (types[i].svg && types[i].svg.path &&
        //       !svgSources[source].selectable[types[i].id]) {
        //       svgSources[source].selectable[types[i].id] = {
        //         "path": types[i].svg.path,
        //         "caption": types[i].keys
        //       };
        //     }
        //   }
        // }
      }
    }

    return {
      types: types,
      ids: ids,
      groups: groups,
      groupingKeys: locals.groupingKeys,
      preferedGroupingKey: preferedGroupingKey,
      keys: keys,
      unnamedType: locals.unnamedType,
      timeFormat: locals.timeFormat,
      ignore: locals.ignore,
      label: label
    };
  };

  _test(filepath) {};

};

module.exports = configLoader;
