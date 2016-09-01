'use strict';

// Module exports
module.exports = processData;

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

function processData(data, name, settings) {

  if (!Array.isArray(data) || settings === undefined) return; // Check for Existence

  // each Function Call new Variables
  var processedData = [],
    exceeds,
    maxDate = data[0].date || 0;

  // Join Data to the Object, which is used by the website
  var element;
  for (var i = 0; i < data.length; i++) {
    var k = 0;
    maxDate = new Date(Math.max(maxDate, data[i].date));

    for (var j = 0; j < data[i].values.length; j++) {
      // head-data of measuring-points
      if (settings.ignore.indexOf(j) === -1 && k < settings.types.length) {
        // if it didn't exist before in process for return
        if (!processedData[k]) {
          element = {};
          if (settings.types[k] && settings.types[k].id)
            element.id = settings.types[k].id;
          else
            element.id = settings.unnamedType.id + k;

          element.values = [];
          processedData[k] = element;
        }
        if (data[i].values[j] !== null) {
          // exceeding
          exceeds = null;
          if (settings.types[k].threshold !== undefined) {
            if (settings.types[k].threshold.from !== undefined &&
                data[i].values[j] < settings.types[k].threshold.from)
              exceeds = false;
            else if (settings.types[k].threshold.to !== undefined &&
                     data[i].values[j] > settings.types[k].threshold.to)
              exceeds = true;
          }
          // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored
          processedData[k].values.push({
            x: data[i].date,
            y: data[i].values[j],
            exceeds: exceeds
          })
        }
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
