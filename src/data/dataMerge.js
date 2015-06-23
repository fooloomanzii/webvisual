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
  var _ = require('underscore'),
      numCols       =  2,
      labelsArray   = [],
      valuesArray   = [],
      exceedsArray  = [],
      dateArray     = [],
      languageArray = [],
      dataStringArray     = [],
      currentExceedsArray = [],
      dataStringObject    = {};

function processData(locals, currentData) {

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
    else {
      labelsArray=locals;
    }

    // Set the Number of different Variables and Columns 'numCols' respectively
    numCols = locals.typeWidth;
    languageArray = locals.language;

    if (numCols < 1) {
      numCols = 1;
    }

    // Create labels for the Value Table 'subtypes' and fill unnamed
    for(var j = 0; j<locals.types.length; j++){
      for(var i = 1; i<=numCols; i++){
        if (!locals.types[j].subtypes[i-1]) {
          labelsArray.types[j].subtypes.push(
            {"method":locals.unnamedSubtype.method+i,
             "unit"  :locals.unnamedSubtype.unit,
             "threshold":locals.unnamedSubtype.threshold});
        }
      }
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
        for (var k=0; k<data[i].values.length; k++) {
          valuesArray[i][k] = data[i].values[k];
        }
        dateArray[i] = new Date(data[i].date);
      }
      // Otherwise: append the Data to that Arrays
      else {
        valuesArray.push(data[i].values);
        dateArray.push(new Date(data[i].date));
      }

      // Create the Labels for the Type Table 'types', if no Labels are defined in 'config.json'
      // (Room 'room' & Type of the Measurement or other Labels 'kind')

      for(var j = 1; j <= (data[i].values.length / numCols); j++){
        if (!labelsArray.types[j-1]) {
          labelsArray.types.push(
            {"id": labelsArray.unnamedType.id,
             "room":labelsArray.unnamedType.room,
             "kind":labelsArray.unnamedType.kind+j,
             "subtypes":[]});
          for(var k = 1; k<=numCols; k++){
            labelsArray.types[j-1].subtypes.push(
              {"method":labelsArray.unnamedSubtype.method + k,"unit":labelsArray.unnamedSubtype.unit,"threshold":labelsArray.unnamedSubtype.threshold});
          }
        }
      }
    }

    // Join Data to the Object, which is used by the website
    for (var i=0; i<dateArray.length; i++) {
      for (var j=0; j<valuesArray[i].length; j++) {
      // l, k are for typed and subtypes
        var l = parseInt(j/numCols);
        var k = j % numCols;
      // head-data of measuring-points
        if(!dataStringArray[j]) {
          dataStringArray.push({"id":      labelsArray.types[l].id.toString(),
                                "room":    labelsArray.types[l].room.toString(),
                                "kind":    labelsArray.types[l].kind.toString(),
                                "method" : labelsArray.types[l].subtypes[k].method.toString(),
                                "unit":    labelsArray.types[l].subtypes[k].unit.toString(),
                                "data":    [] })
        }
      // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored
        dataStringArray[j].data.push({"date":    dateArray[i],
                                      "value":   valuesArray[i][j],
                                      "exceeds": exceedsArray[i][j]
                                    })
        if(exceedsArray[i][j]) {
          var m = _.findLastIndex(currentExceedsArray,
                                   {"id":  labelsArray.types[l].id.toString(),
                                    "room":    labelsArray.types[l].room.toString(),
                                    "kind":    labelsArray.types[l].kind.toString(),
                                    "method":  labelsArray.types[l].subtypes[k].method.toString(),
                                    "unit":    labelsArray.types[l].subtypes[k].unit.toString()});
          if(m == -1){
            m = currentExceedsArray.length;
            currentExceedsArray.push({"id":      labelsArray.types[l].id.toString(),
                                      "room":    labelsArray.types[l].room.toString(),
                                      "kind":    labelsArray.types[l].kind.toString(),
                                      "method":  labelsArray.types[l].subtypes[k].method.toString(),
                                      "unit":    labelsArray.types[l].subtypes[k].unit.toString(),
                                      "data":    [] })
          }
          currentExceedsArray[m].data = [{"date":    dateArray[i],
                                          "value":   valuesArray[i][j],
                                          "exceeds": exceedsArray[i][j] }];
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
