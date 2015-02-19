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
function getExceeds(data, exceedsHandler){
  if(data === undefined || !Array.isArray(data) || 
      data.length == 0) return [];
  var limits= _.defaults(require('../config/threshold.json'), defaults);
  if(!Object.keys(limits).length) return [];
  var tmp=data.length-1,
      n=parseInt(data[tmp].values.length/funclen, 10),
      exceeds=[[],[]];
  // iterate through all data values
  for(var i=0; i<n; i++) {
    for(var j=funclen*i; j<funclen*(i+1);j++){
      // Compare with special thresholds
      if(limits[i] && limits[i].length==2){
        exceeds[0][j]=(data[tmp].values[j]<limits[i][0]);
        exceeds[1][j]=(data[tmp].values[j]>limits[i][1]);
      // Compare with defaults
      }else if (limits.defaults && limits.defaults.length==2 ){
        exceeds[0][j]=(data[tmp].values[j]<limits.defaults[0]);
        exceeds[1][j]=(data[tmp].values[j]>limits.defaults[1]);
      }
    }
  }
  if(exceedsHandler && typeof(exceedsHandler) == 'function') 
      exceedsHandler(exceeds);
  return exceeds;
}

// Exported functions
module.exports = {
  // Public
    getExceeds : getExceeds
};

})();