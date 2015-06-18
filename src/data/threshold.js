(function() {
'use strict';

var _           = require('underscore'),
    defaults={},
    // how many values include one function
    funclen=2;

/* Checks the data on thresholds
 *  data - the parsed data array with real numeric values
 *  returns two dimensional array with positions of exceeds
 *    0 - underflow
 *    1 - overflow
 *
 *  beyondsHandler() becomes the exceeds to deal with, before anything else
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

  //// Auslesen der Anzahl der Messwerte
  var funclen = config.locals.typeWidth;

  //// Auslesen der Grenzwerte der einzelnen Elemente
  var limitsArray = [];
  for (var i=0; i<config.locals.types.length; i++){
    var row = [];
    for (var j=0; j<2; j++) {
      row.push(config.locals.types[i].subtypes[j].threshold);
    }
    limitsArray.push(row);
  }

  //// Vergleich mit den Grenzwerten aus exceedsArray
    // Lesen aller Zeilen
  var exceedsArray=[];
  for (var i=0; i<data.length; i++){
    var row = [];
    // Iteration durch alle Einheiten innerhalb der Zeile
    for (var j=0; j<(data[i].values.length/funclen); j++) {
        // Typen eines Raums
      for(var k=0; k<funclen; k++)
        {
          var elem = null;
          if(limitsArray[j]){
            if(limitsArray[j][k]){
                // unter unterer Grenze => false | über ober Grenze => true | sonst bleibt => null
                if (data[i].values[j*funclen+k]<limitsArray[j][k][0]) {
                  elem = false;
                }
                else if (data[i].values[j*funclen+k]>limitsArray[j][k][1]) {
                  elem = true;
                }
            }
          }
          row.push(elem);
        }
      }
    exceedsArray.push(row);
  }

  if(exceedsHandler && typeof(exceedsHandler) == 'function')
      exceedsHandler(exceedsArray);
  return exceedsArray;

  // if(!Object.keys(limits).length) return [];
  // var tmp=data.length-1,
  //     n=parseInt(data[tmp].values.length/funclen, 10),
  //     exceeds=[[],[]];
  // // iterate through all data values
  // console.log(data[tmp].values);
  // for(var i=0; i<n; i++) {
  //
  //   for(var j=funclen*i; j<funclen*(i+1);j++){
  //     // Compare with special thresholds
  //     if(limits[i] && limits[i].length==2){
  //       exceeds[0][j]=(data[tmp].values[j]<limits[i][0]);
  //       exceeds[1][j]=(data[tmp].values[j]>limits[i][1]);
  //     // Compare with defaults
  //     }else if (limits.defaults && limits.defaults.length==2 ){
  //       exceeds[0][j]=(data[tmp].values[j]<limits.defaults[0]);
  //       exceeds[1][j]=(data[tmp].values[j]>limits.defaults[1]);
  //     }
  //   }
  // }
  // if(exceedsHandler && typeof(exceedsHandler) == 'function')
  //     exceedsHandler(exceeds);
  // return exceeds;


}

// Exported functions
module.exports = {
  // Public
    getExceeds : getExceeds
};

})();
