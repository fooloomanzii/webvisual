'use strict';

// Exported functions
module.exports = getExceeds;

/* Checks the data on thresholds
 *  data - the parsed data array with real numeric values
 *  returns two dimensional array with positions of exceeds
 *    false - underflow
 *    true  - overflow
 *    null  - normal
 */

function getExceeds(data, types, exceedsHandler){
  if(data == undefined || types == undefined || types.length == 0 || data.length == 0) return [];

  //// Auslesen der Grenzwerte der einzelnen Elemente
  var limitsArray = [];
  for (var i=0; i<types.length; i++){
    if (types[i].threshold)
      limitsArray.push(types[i].threshold);
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
