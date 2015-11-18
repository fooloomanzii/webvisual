'use strict';

// Module exports
module.exports = arrangeTypes;

var _ = require('underscore');

function arrangeTypes(locals) {

  if(!locals || !locals.types)
    return; // Check the Existence

  var types = [];
  var type;
  var keys =  _.keys(locals.unnamedType);

  // all defined types are processed
  for (var i=0; i<locals.types.length; i++) {
    // ignored if set in locals.ignore
    if(locals.ignore && locals.ignore.indexOf(i) == -1){
      type = locals.types[i] || {};
      for (var j=0; j<keys.length; j++){
        type[keys[j]] = type[keys[j]] || locals.unnamedType[keys[j]];
      }
      // id has to be different from unnamedType
      if (type.id == locals.unnamedType.id)
        type.id += i;
      types.push(type);
    }
  }

  return {types: types, unnamedType: locals.unnamedType, timeFormat: locals.timeFormat, ignore: locals.ignore};
}
