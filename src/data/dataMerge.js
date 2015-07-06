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
  //      conten: Object of:
  //       "0": { "id":".." , "room":"..", "kind":"..", "method":"..", lastExceeds:
  //            {"x":"..", "y":"..", "exceeds":".."}, "unit":"..", "values":
  //            [ {"x":"..", "y":"..", "exceeds":".."}, {..} , .. ] },
  //       "2":

  // Session Variables
  // (don't change, if server is not restartet)
  var _            = require('underscore'),
      dateFormat   = require('dateFormat'),
      settings   = {},
      keys       = [],
      groups     = {},
      lastExceedsArray = [];

function processData(locals, currentData) {

  if(locals === undefined ||
     currentData === undefined)
    return; // Check the Existence

  // each Function Call new Variables
  var valuesArray   = [],
      exceedsArray  = [],
      dateArray     = [],
      processedData = {},
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
    if(!settings.unnamedType)
      settings.unnamedType = locals.unnamedType;

    if(keys.length == 0){
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
          if(!lastExceedsArray)
            lastExceedsArray.push(null);
        }
        dateArray[i] = data[i].date;
      }
      // Otherwise: append the Data to that Arrays
      else {
        valuesArray.push(data[i].values);
        dateArray.push(data[i].date);
      }
    }
    // Join Data to the Object, which is used by the website
    var element, key, type, group;
    for (var i=0; i<dateArray.length; i++) {
      var k = 0;
      for (var j=0; j<valuesArray[i].length; j++) {
      // head-data of measuring-points
        if(settings.ignore.indexOf(j) == -1){ // ignored are not in returnObject
          if(!processedData[k]) {
            element = {};
            type = settings.types[j] || [];
            for (var m=0; m<keys.length; m++){
              key = keys[m];
              group = groups[key];
              element[key] = type[key] || settings.unnamedType[key];
              if (typeof element[key] == "Object" && _.findLastIndex(group,element[key]) == -1) // all containing keyvalues
                group.push(element[key]); // (except exceeds, x, y)
              else if (_.lastIndexOf(group,element[key]) == -1)
                group.push(element[key]);
            }
            element.values = [];
            if (element.id == settings.unnamedType.id)
              element.id += k;
            element.lastExceeds = lastExceedsArray[j];
            processedData[k] = element;
          }
          // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored

          processedData[k].values.push({"x":    dateArray[i],
                                             "y":   valuesArray[i][j],
                                             "exceeds": exceedsArray[i][j]
                                      })
          // store last Exceeding Data (lastExceedsArray is created each server-session)
          if(exceedsArray[i][j] != null)
            lastExceedsArray[j] = processedData[k].lastExceeds = {"x": dateArray[i],
                                                                       "y": valuesArray[i][j],
                                                                       "exceeds": exceedsArray[i][j]};
          k++;
        }
      }
    }

      // Creation of an Return Object
      // TODO: socket for each messurement-device possible?
    returnObject = {time: currentData.time, content: processedData, groups: groups};
  }

  return returnObject;
}

// Module exports
module.exports = {
  // Public
  processData: processData
};

})();
