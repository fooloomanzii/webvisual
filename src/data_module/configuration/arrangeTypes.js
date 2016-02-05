'use strict';

// Module exports
module.exports = arrangeTypes;

var defaults = {
  values: [{
    x: new Date(),
    y: 0,
    exceeds: null
  }]
};

function arrangeTypes(label, labelindex, locals) {

  if (!locals || !locals.types)
    return; // Check the Existence

  var types = [];
  var ids = [];
  var type;
  var keys = Object.keys(locals.unnamedType);

  // all defined types are processed
  for (var i = 0; i < locals.types.length; i++) {
    // ignored if set in locals.ignore
    if (locals.ignore && locals.ignore.indexOf(i) == -1) {
      type = locals.types[i] || {};
      for (var j = 0; j < keys.length; j++) {
        type[keys[j]] = type[keys[j]] || locals.unnamedType[keys[j]];
      }
      // label
      type.label = label;
      // isExceeding
      type.isExceeding = false;
      // lastExceeds
      type.lastExceeds = [];
      // lastExceeds
      type.firstExceeds = [];
      // if types of values is not an Array or doesn't exist then use the default
      if (!type.values || !Array.isArray(type.values))
        type.values = defaults.values;
      // id has to be different from unnamedType
      if (type.id == locals.unnamedType.id)
        type.id += i;
      types.push(type);
      ids.push(type.id);
    }
  }

  // GROUPING
  // note:      this speeds up client handling of grouping, and could save transmitted
  //            data initially
  // structure: groups: [{ key: '---',
  //                       subgroups: [ { name: '---'
  //                                      elements: [ {id = '---', ...}, ...]
  //                                      ids: [ '---', ....]
  //                                    },...]
  //                     },...]
  // initialy set the preferedGroups
  var groups = locals.exclusiveGroups;
  var key, where, needToSetElement, needToSetGroup;

  var groupingKeys = locals.groupingKeys;
  if (groupingKeys.indexOf('all') == -1) {
    groupingKeys.push('all');
  }
  var preferedGroupingKey = locals.preferedGroupingKey || groupingKeys[0];

  for (var i = 0; i < types.length; i++) {
    for (var j = 0; j < groupingKeys.length; j++) {
      key = groupingKeys[j];
      needToSetElement = true;
      needToSetGroup = true;
      where = -1;

      // if (key == 'all' && types[i][key] == undefined)
      //   types[i][key] = 'all';

      for (var l = 0; l < groups.length; l++)
        if (groups[l].key == key) {
          needToSetGroup = false;
          break;
        }
      if (needToSetGroup) {
        groups.push({
          key: key,
          subgroup: []
        });
      }
      for (var k = 0; k < groups[l].subgroup.length; k++) {
        if (groups[l].subgroup[k].ids && groups[l].subgroup[k].ids.indexOf(types[i].id) != -1) {
          needToSetElement = false;
          if (!groups[l].subgroup[k].elements || !Array.isArray(groups[l].subgroup[k].elements)) {
            groups[l].subgroup[k].elements = [];
          }
          if (groups[l].subgroup[k].elements.indexOf(types[i]) == -1) {
            groups[l].subgroup[k].elements.push(types[i]);
          }
          break;
        }
        if (groups[l].subgroup[k].name == types[i][key]) {
          where = k;
        } else if (key == 'all') {
          where = k;
        }
      }
      // if (key=='roomNr')
      //   console.log(where);
      if (needToSetElement) {
        if (where == -1) {
          groups[l].subgroup.push({
            name: types[i][key] || ((key == 'all') ? 'all' : ''),
            ids: [types[i].id],
            elements: [types[i]]
          });
        } else {
          groups[l].subgroup[where].ids.push(types[i].id);
          if (!groups[l].subgroup[where].elements)
            groups[l].subgroup[where].elements = [];
          groups[l].subgroup[where].elements.push(types[i]);
        }
      }
    }
  }



  // PATHSTRUCTURE
  // for faster finding elements for client
  // made for Polymer 1.2 Array structure

  var paths = {};
  for (var i = 0; i < groups.length; i++) {
    paths[groups[i].key] = {};
    for (var j = 0; j < groups[i].subgroup.length; j++) {
      // paths[groups[i].key][groups[i].subgroup[j].name] = {};
      for (var k = 0; k < groups[i].subgroup[j].ids.length; k++) {
        paths[groups[i].key][groups[i].subgroup[j].ids[k]] = 'data.' +
          labelindex + '.groups.' + i + '.subgroup.' + j + '.elements.' + k + '.values';
      }
    }
  }

  return {
    types: types,
    ids: ids,
    groups: groups,
    paths: paths,
    groupingKeys: locals.groupingKeys,
    preferedGroupingKey: preferedGroupingKey,
    keys: keys,
    unnamedType: locals.unnamedType,
    timeFormat: locals.timeFormat,
    ignore: locals.ignore
  };
}
