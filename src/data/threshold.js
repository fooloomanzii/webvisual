(function() {
'use strict';

var _        = require('underscore'),
    defaults = {};

/* Checks the data on thresholds
 *  data - the parsed data array with real numeric values
 *  returns two dimensional array with positions of exceeds
 *    false - underflow
 *    true  - overflow
 *    null  - normal
 */

 /*
  * Theshold arbeitet nicht dynamisch --> wenn sich in config, was an den
  * Grenzen ändert, nimmt er die alte Konfiguration
  * TODO: dynamisch machen
  *
  *
  */

function getExceeds(data, exceedsHandler){
  if(data === undefined || !Array.isArray(data) || data.length == 0) return [];

  //// Laden der Konfiguration
  var config= _.defaults(require('../config/config.json'), defaults);

  //// Auslesen der Grenzwerte der einzelnen Elemente
  var limitsArray = [];
  for (var i=0; i<config.locals.types.length; i++){
    if (config.locals.types[i].threshold)
      limitsArray.push(config.locals.types[i].threshold);
    else
      limitsArray.push([]);
  }

  //// Vergleich mit den Grenzwerten aus exceedsArray
    // Lesen aller Zeilen
  var exceedsArray=[];
  for (var i=0; i<data.length; i++){
    var row = [];
    // Iteration durch alle Einheiten innerhalb der Zeile
    for (var j=0; j<data[i].values.length; j++) {
        var elem = null;
        if(limitsArray[j]){
          // unter unterer Grenze => false | über ober Grenze => true | sonst bleibt => null
          if (data[i].values[j]<limitsArray[j].from)
            elem = false;
          else if (data[i].values[j]>limitsArray[j].to)
            elem = true;
        }
        row.push(elem);
    }
    exceedsArray.push(row);
  }

  if(exceedsHandler && typeof(exceedsHandler) == 'function')
      exceedsHandler(exceedsArray);
  return exceedsArray;
}

// Exported functions
module.exports = {
  // Public
    getExceeds : getExceeds
};

})();
