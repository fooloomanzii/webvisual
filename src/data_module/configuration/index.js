var exportObj               = {};
    exportObj.arrangeTypes  = require('./arrangeTypes.js');
    exportObj.get           = getConfig,
    dataFileHandler         = require('../filehandler/data.js'),
    path                    = require('path'),
    _                       = require('underscore');

module.exports = exportObj;

function getConfig() {
  _readFromFile();
}

function _readFromFile(configPath) {
  var options = {
    "file": {
      "copy": false,
      "mode": "complete",
      "path_folder": (__dirname + '/../../config/'),
      "path": "config.json",
      "process": JSON.parse
      }
    }
  var change, actual;
  var configFile =
    new dataFileHandler( {
      connection: options,
      listener: {
        error: function(type, err) {
          console.error("config incorrect");
        },
        data: function(type, data) {
          if (actual !== undefined) {
            change = _.diff(data,actual);
            console.info(change);
            console.info("config changed "+type);
          }
          else
            actual = data;
        }
      }
    });
    _.mixin({
        shallowDiff: function(a,b) {
            return _.omit(a, function(v,k) { return b[k] === v; })
        },
        diff: function(a,b) {
            var r = {};
            _.each(a, function(v,k) {
                if(b[k] === v) return;
                // but what if it returns an empty object? still attach?
                r[k] = _.isObject(v)
                        ? _.diff(v, b[k])
                        : v
                    ;
                });
            return r;
        }
    });
  configFile.connect();
}

function _mergeDefaults(config) {

}