var exportObj               = require('./data.js');
    exportObj.threshold     = require('./threshold.js');
    exportObj.dataMerge     = require('./dataMerge.js');
    exportObj.dataConfig    = require('./dataConfig.js');
    exportObj.client        = require('./client.js').Client;

module.exports = exportObj;
