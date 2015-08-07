var exportObj               = require('./data.js');
    exportObj.DataChecker   = require('./DataChecker.js');
    exportObj.threshold     = require('./threshold.js');
    exportObj.dataMerge     = require('./dataMerge.js');
    exportObj.client        = require('./client.js').Client;

module.exports = exportObj;
