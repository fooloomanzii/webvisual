'use strict';

// Module exports
module.exports = arrangeTypes;

var _ = require('underscore');

function arrangeTypes(locals) {

  if (!locals || !locals.types)
    return; // Check the Existence

  var types = [];
  var ids = [];
  var type;
  var keys = _.keys(locals.unnamedType);

  // all defined types are processed
  for (var i = 0; i < locals.types.length; i++) {
    // ignored if set in locals.ignore
    if (locals.ignore && locals.ignore.indexOf(i) == -1) {
      type = locals.types[i] || {};
      for (var j = 0; j < keys.length; j++) {
        type[keys[j]] = type[keys[j]] || locals.unnamedType[keys[j]];
      }
      // id has to be different from unnamedType
      if (type.id == locals.unnamedType.id)
        type.id += i;
      types.push(type);
      ids.push(type.id);
    }
  }

  // grouping
  var group = {};
  var groups = locals.exclusiveGroups;
  var key, needToSet, where;

  var groupingKeys = locals.groupingKeys;
  if (groupingKeys.indexOf('all') == -1) {
    groupingKeys.push('all');
  }
  var preferedGroupingKey = locals.preferedGroupingKey || groupingKeys[0];

  for (var i = 0; i < types.length; i++) {
    for (var j = 0; j < groupingKeys.length; j++) {
      key = groupingKeys[j];
      if (!groups[key])
        groups[key] = [];

      needToSet = true;
      where = -1;
      for (var k = 0; k < groups[key].length; k++) {
        if (groups[key][k].ids &&
            groups[key][k].ids.indexOf(types[i].id) != -1) {
          needToSet = false;
          break;
        }
        if (groups[key][k].name == types[i][key]) {
          where = k;
        }
      }

      if (needToSet) {
        if (where == -1) {
          group = {};
          group.name = types[i][key];
          group.ids = [ types[i].id ];
          group.elements = []; // experimental
          groups[key].push(group);
        } else
          groups[key][where].ids.push(types[i].id);
      }
    }
  }

  if (!groups.all[0].name)
    groups.all[0].name = 'all';

  return {
    types : types,
    ids : ids,
    groups : groups,
    groupingKeys: locals.groupingKeys,
    preferedGroupingKey: preferedGroupingKey,
    keys : keys,
    unnamedType : locals.unnamedType,
    timeFormat : locals.timeFormat,
    ignore : locals.ignore
  };
}
