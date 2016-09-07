'use strict';

// Module exports
module.exports = processData;

// Process incoming Data

//  Parameters:
//    settings: configuration (dataConfig)
//    currentData: data (copywatch & exceedingState)
//      currentData.data <-- Array of Strings
//      currentData.exceedingState <-- Object of Boolean-Arrays
//  Return:
//    JSON-Object-Structure:
//      content: Object of:
//       "0": { "id":"..", lastexceedingState: {"x":"..", "y":"..", "exceedingState":".."},
//                "values": [ {"x":"..", "y":"..", "exceedingState":".."}, {..} , .. ] },
//       "1":

function processData(data, name, settings) {

  if (!Array.isArray(data) || settings === undefined) return; // Check for Existence

  // each Function Call new Variables
  var processedData = {},
    exceedingState, id,
    maxDate = data[0].date || 0;

  // Join Data to the Object, which is used by the website
  var element;
  for (var i = 0; i < data.length; i++) {
    var k = 0;
    maxDate = +(new Date(Math.max(maxDate, data[i].date)));

    for (var j = 0; j < data[i].values.length; j++) {
      // head-data of measuring-points
      if (settings.ignore.indexOf(j) === -1 && k < settings.types.length) {
        // if it didn't exist before in process for return
        id = settings.types[k].id || settings.unnamedType.id + k;
        if (!processedData[id]) {
          processedData[id] = {values: []};
        }
        exceedingState = null;
        if (data[i].values[j] !== null) {
          // exceeding
          if (settings.types[k].threshold !== undefined) {
            if (settings.types[k].threshold.from !== undefined &&
                data[i].values[j] < settings.types[k].threshold.from)
              exceedingState = false;
            else if (settings.types[k].threshold.to !== undefined &&
                     data[i].values[j] > settings.types[k].threshold.to)
              exceedingState = true;
          }
        }
        // .data is the array, in which the measuring time, the value itself and an exceedingState-value is stored
        processedData[id].values.push({
          x: +(new Date(data[i].date)),
          y: data[i].values[j],
          exceedingState: exceedingState
        })
        k++;
      }
    }
  }

  return {
    content: processedData,
    name: name,
    label: settings.label,
    date: maxDate
  };
}
