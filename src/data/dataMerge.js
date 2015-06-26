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

  // global Variables
  var _            = require('underscore'),
      dateFormat   = require('dateFormat'),
      labelsArray   = [],
      languageArray = [],
      numCols       =  0;

function processData(locals, currentData) {

  var valuesArray   = [],
      exceedsArray  = [],
      dateArray     = [],
      dataStringArray     = [],
      currentExceedsArray = [],
      dataStringObject    = {};

  if(locals === undefined ||
     currentData === undefined)
    return; // Check the Existence

  arrangeLabels(locals);

  arrangeData(currentData.data, currentData.exceeds);

  function arrangeLabels(locals) {
    if (!locals) { // Check for Existence
      console.warn("There is no configuration.");
      return;
    }
    // if labels already exist, then they are not rewritten
    // TODO: handle change on config file
    else if (labelsArray.length == 0) {
      labelsArray=locals;
    }
    else {
      return;
    }

    languageArray = locals.language;
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
            data[i].date,labelsArray.timeFormat);
      }
      // Otherwise: append the Data to that Arrays
      else {
        valuesArray.push(data[i].values);
        dateArray.push(dateFormat(
            data[i].date,labelsArray.timeFormat));
      }
    }

    // Join Data to the Object, which is used by the website
    for (var i=0; i<dateArray.length; i++) {
      for (var j=0; j<valuesArray[i].length; j++) {
      // head-data of measuring-points
        if(!dataStringArray[j]) {
          if (labelsArray.types[j])
            dataStringArray.push({"id":      labelsArray.types[j].id || labelsArray.unnamedType.id+" "+j,
                                  "room":    labelsArray.types[j].room || labelsArray.unnamedType.room,
                                  "roomNr":  labelsArray.types[j].roomNr || labelsArray.unnamedType.roomNr,
                                  "kind":    labelsArray.types[j].kind || labelsArray.unnamedType.kind,
                                  "method":    labelsArray.types[j].method || labelsArray.unnamedType.method,
                                  "unit":    labelsArray.types[j].unit || labelsArray.unnamedType.unit,
                                  "isBoolean":    labelsArray.types[j].isBoolean || labelsArray.unnamedType.isBoolean,
                                  "data":    [] });
          else dataStringArray.push({"id":     labelsArray.unnamedType.id,
                                  "room":      labelsArray.unnamedType.room,
                                  "kind":      labelsArray.unnamedType.kind,
                                  "method":    labelsArray.unnamedType.subtypes.method,
                                  "unit":      labelsArray.unnamedType.subtypes.unit,
                                  "isBoolean": labelsArray.unnamedType.subtypes.isBoolean,
                                  "data":      [] });
          }
      // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored
        dataStringArray[j].data.push({"date":    dateArray[i],
                                      "value":   valuesArray[i][j],
                                      "exceeds": exceedsArray[i][j]
                                    })
      // TODO: update and send currentExceedsArray session-whise
        if(exceedsArray[i][j]) {
          var m = _.findLastIndex(currentExceedsArray,
                                   {"id":     dataStringArray[j].id,
                                    "room":   dataStringArray[j].room,
                                    "kind":   dataStringArray[j].kind,
                                    "method": dataStringArray[j].method,
                                    "unit":   dataStringArray[j].unit});
          if(m == -1){
            m = currentExceedsArray.length;
            currentExceedsArray.push({"id":     dataStringArray[j].id,
                                      "room":   dataStringArray[j].room,
                                      "kind":   dataStringArray[j].kind,
                                      "method": dataStringArray[j].method,
                                      "unit":   dataStringArray[j].unit,
                                      "data":   [] })
          }
          currentExceedsArray[m].data = [{"date":    dateArray[i],
                                          "value":   valuesArray[i][j],
                                          "exceeds": exceedsArray[i][j] }];
        }


      }
    }

      // Creation of an Object, so it can be assigned to the Eventhandler (dirty)
    dataStringObject = {time: currentData.time, content: dataStringArray, lastExceeds: currentExceedsArray, lineCount: currentData.lineCount};
  }

  return dataStringObject;
}

// Module exports
module.exports = {
  // Public
  processData: processData
};

})();
