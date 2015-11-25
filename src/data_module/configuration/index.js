var exportObj               = {};
    exportObj.arrangeTypes  = require('./arrangeTypes.js');
    exportObj.get           = getConfig,
    dataFileHandler         = require('../filehandler/data.js'),
    path                    = require('path');

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
  var configFile =
    new dataFileHandler( {
      connection: options,
      listener: {
        error: function(type, err) {
          console.error("config incorrect");
        },
        data: function(type, data) {
          console.info("config changed");
        }
      }
    });
  configFile.connect();
}

function _handleChange(configPath) {

}

function _mergeDefaults(config) {

}
