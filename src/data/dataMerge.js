(function(){
'use strict';

  // Process incoming Data

  //  Parameters:
  //    settings: configuration (dataConfig)
  //    currentData: data (copywatch & exceeds)
  //      currentData.data <-- Array of Strings
  //      currentData.exceeds <-- Object of Boolean-Arrays
  //  Return:
  //    JSON-Object-Structure:
  //      content: Object of:
  //       "0": { "id":"..", lastExceeds: {"x":"..", "y":"..", "exceeds":".."},
  //                "values": [ {"x":"..", "y":"..", "exceeds":".."}, {..} , .. ] },
  //       "1":

  // Session Variables
  // (don't change, if server is not restartet)
  var dateFormat   = require('dateFormat'),
      _            = require('underscore'),
      settings   = {},
      lastExceedsArray = [];

function processData(settings, currentData) {

  if(settings === undefined ||
     currentData === undefined)
    return; // Check the Existence

  // each Function Call new Variables
  var valuesArray   = [],
      exceedsArray  = [],
      dateArray     = [],
      processedData = [],
      returnObject  = {};

  arrangeData(currentData.data, currentData.exceeds);

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
    var element;
    for (var i=0; i<dateArray.length; i++) {
      var k = 0;
      for (var j=0; j<valuesArray[i].length; j++) {
      // head-data of measuring-points
        if(settings.ignore.indexOf(j) == -1){ // ignored are not in returnObject
          // if it didn't exist before in process for return
          if(!processedData[k]) {
            element = {};
            if(settings.types[j] && settings.types[j].id)
              element.id = settings.types[j].id;
            else
              element.id = settings.unnamedType.id + k;
            element.values = [];
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
    returnObject = {time: currentData.time, content: processedData};
  }
  return returnObject;
}

// Module exports
module.exports = {
  // Public
  processData: processData
};

})();
