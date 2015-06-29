(function(){
'use strict';

  // Process incoming Data

  //  Parameters:
  //    locals: configuration (config.json)
  //    currentData: data (copywatch & exceeds)
  //      currentData.data <-- Array of Strings
  //      currentData.exceeds <-- Object of Boolean-Arrays
  //  Return:
  //    JSON-Object-Structure:
  //      Array of:
  //        { "id":".." , "room":"..", "kind":"..", "method":"..",
  //          "unit":"..", "data": [{"date":"..", "value":"..", "exceeds":".."}, {..} , .. ]} a.s.o.

  // Session Variables
  var _            = require('underscore'),
      dateFormat   = require('dateFormat'),
      settings   = {},
      keys       = [],
      groups     = {},
      currentExceedsArray = [];

function processData(locals, currentData) {

  if(locals === undefined ||
     currentData === undefined)
    return; // Check the Existence

  // each Function Call new Variables
  var valuesArray   = [],
      exceedsArray  = [],
      dateArray     = [],
      processedDataArray  = [],
      returnObject = {};

  arrangeLabels(locals);

  arrangeData(currentData.data, currentData.exceeds);

  function arrangeLabels(locals) {
    if(!settings.types)
      settings.types = locals.types;
    if(!settings.ignore)
      settings.ignore = locals.ignore;
    if(!settings.timeFormat)
      settings.timeFormat = locals.timeFormat;
    if(!settings.unnamedType){
      settings.unnamedType = locals.unnamedType;

      keys =  _.keys(settings.unnamedType);
      for (var i = 0; i < keys.length; i++)
        groups[keys[i]] = [];
    }
  }

  function arrangeData(data, exceeds){
    if(!data || data.length == 0 ) return;  // Check for Existence

    // Set the Arrays of Exceeds 'exceedsArray'
    var exceedsArray = exceeds;

    // Set the Array of Values 'valuesArray' and Array of Timestamps 'dateArray'
    for (var i=0; i<data.length; i++) {
      // If that Data exists, it will be overwritten
      if(valuesArray[i] && dateArray[i]) {
        for (var l=0; l<data[i].values.length; l++) {
          valuesArray[i][l] = data[i].values[l];
        }
        dateArray[i] = dateFormat(
            data[i].date,settings.timeFormat);
      }
      // Otherwise: append the Data to that Arrays
      else {
        valuesArray.push(data[i].values);
        dateArray.push(dateFormat(
          data[i].date,settings.timeFormat));
      }
    }
    // Join Data to the Object, which is used by the website
    var value, key, type, group;
    for (var i=0; i<dateArray.length; i++) {
      var k = 0;
      for (var j=0; j<valuesArray[i].length; j++) {
      // head-data of measuring-points
        if(settings.ignore.indexOf(j) == -1){ // ignored are not in returnObject
          if(!processedDataArray[k]) {
            value = {};
            type = settings.types[j] || [];
            for (var m=0; m<keys.length; m++){
              key = keys[m];
              group = groups[key];
              value[key] = type[key] || settings.unnamedType[key];
              if (_.findIndex(group,{"key":value[key]}) == -1) // all containing
                group.push({"key":value[key]});
            }
            value.data = [];
            if (value.id == settings.unnamedType.id)
              value.id += k;
            processedDataArray.push(value);
          }
          // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored

          processedDataArray[k].data.push({"date":    dateArray[i],
                                           "value":   valuesArray[i][j],
                                           "exceeds": exceedsArray[i][j]
                                      })
          // store last Exceeding Data (index not the same like in returnObject)
          if(exceedsArray[i][j] != null) {
            var m = _.findLastIndex(currentExceedsArray,
                                     {"id":     processedDataArray[k].id,
                                      "room":   processedDataArray[k].room,
                                      "kind":   processedDataArray[k].kind,
                                      "method": processedDataArray[k].method,
                                      "unit":   processedDataArray[k].unit});
            if(m == -1){
              m = currentExceedsArray.length;
              currentExceedsArray.push({"id":     processedDataArray[k].id,
                                        "room":   processedDataArray[k].room,
                                        "kind":   processedDataArray[k].kind,
                                        "method": processedDataArray[k].method,
                                        "unit":   processedDataArray[k].unit,
                                        "data":   [] })
            }
            currentExceedsArray[m].data = [{"date":    dateArray[i],
                                            "value":   valuesArray[i][j],
                                            "exceeds": exceedsArray[i][j] }];
          }
          k++;
        }
      }
    }

      // Creation of an Object, so it can be assigned to the Eventhandler (dirty)
    returnObject = {time: currentData.time, content: processedDataArray, lastExceeds: currentExceedsArray, lineCount: currentData.lineCount, groups: groups};
  }

  return returnObject;
}

// Module exports
module.exports = {
  // Public
  processData: processData
};

})();
