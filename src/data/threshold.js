(function() {
'use strict';

var typechecker = require('typechecker'),
    _           = require('underscore'),
    defaults={},
    // how many values include one function
    funclen=2;

/* Checks the data on thresholds
 *  data - the parsed data array with real numeric values
 *  returns two dimensional array with positions of variances
 *    0 - underflow
 *    1 - overflow
 */
function getVariances(data){
  if(data === undefined || !typechecker.isArray(data) || 
      data.length == 0) return [];
  var limits= _.defaults(require('../config/threshold.json'), defaults);
  if(!Object.keys(limits).length) return [];
  var tmp=data.length-1,
      n=parseInt(data[tmp].values.length/funclen, 10),
      variances=[[],[]];
  // iterate through all data values
  for(var i=0; i<n; i++) {
    for(var j=funclen*i; j<funclen*(i+1);j++){
      // Compare with defaults
      if(limits.default && limits.default.length==2 ){
        variances[0][j]=(data[tmp].values[j]<limits.default[0]);
        variances[1][j]=(data[tmp].values[j]>limits.default[1]);
      }
      // Compare with special thresholds
      if(limits[i] && limits[i].length==2){
        variances[0][j]=(data[tmp].values[j]<limits[i][0]);
        variances[1][j]=(data[tmp].values[j]>limits[i][1]);
      }
    }
  }
  return variances;
}

// Exported functions
module.exports = {
  // Public
    getVariances : getVariances
};

})();