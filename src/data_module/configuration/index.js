var exportObj               = {};
    exportObj.arrangeTypes  = require('./arrangeTypes.js');
    exportObj.get           = get,
    dataFileHandler         = require('../filehandler/data.js'),
    path                    = require('path'),
    _                       = require('underscore');

// Extend Underscore
// Getting deep Differences of Objects
_.mixin({
    diff: function(a,b) {
        var r = {};
        _.each(a, function(v,k) {
            if(_.isEqual(b[k], v)) return;
            r[k] = _.isObject(v)
                    ? _.diff(v, b[k])
                    : v
                ;
            });
        return r;
    }
  });

module.exports = exportObj;

function get() {
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
            return data;
        }
      }
    });
  configFile.connect();
}

function _mergeDefaults(config) {

}
