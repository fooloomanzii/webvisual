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

    // Set the Number of different Variables and Columns 'numCols' respectively
    numCols = 0
    for (var i=0; i<labelsArray.types.length; i++)
      for (var j=0; j<labelsArray.types[i].subtypes.length; j++)
        numCols++;

    if (numCols < 1) {
      numCols = 1;
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
      // l, k are for types and subtypes
      var l = 0;
      var k = 0;
      for (var j=0; j<valuesArray[i].length; j++) {
      // head-data of measuring-points
        if(!dataStringArray[j]) {
          if (labelsArray.types[l]){
            dataStringArray.push({"id":      labelsArray.types[l].id || labelsArray.unnamedType.id+l,
                                  "room":    labelsArray.types[l].room || labelsArray.unnamedType.room,
                                  "kind":    labelsArray.types[l].kind || labelsArray.unnamedType.kind,
                                  "data":    [] });
            if (labelsArray.types[l].subtypes){
              dataStringArray[j].method = labelsArray.types[l].subtypes[k].method;
              dataStringArray[j].unit = labelsArray.types[l].subtypes[k].unit;
              }
            else {
              dataStringArray[j].method = labelsArray.unnamedType.subtypes.method;
              dataStringArray[j].unit = labelsArray.unnamedType.subtypes.unit;
            }
          }
          else {
            dataStringArray.push({"id":      labelsArray.unnamedType.id+l,
                                  "room":    labelsArray.unnamedType.room,
                                  "kind":    labelsArray.unnamedType.kind,
                                  "method":  labelsArray.unnamedType.subtypes.method,
                                  "unit":    labelsArray.unnamedType.subtypes.unit,
                                  "data":    [] });
          }
        }
      // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored
        dataStringArray[j].data.push({"date":    dateArray[i],
                                      "value":   valuesArray[i][j],
                                      "exceeds": exceedsArray[i][j]
                                    })
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

        // jump in array of types and subtypes
        if (labelsArray.types[l] && labelsArray.types[l].subtypes && (k+1 < labelsArray.types[l].subtypes.length))
          k++;
        else{
          k = 0;
          l++;
        }

      }
    }

      // Creation of an Object, so it can be assigned to the Eventhandler (dirty)
    dataStringObject = {time: currentData.time, content: dataStringArray, lastExceeds: currentExceedsArray};
  }

  return dataStringObject;
}

// Module exports
module.exports = {
  // Public
  processData: processData
};

})();
