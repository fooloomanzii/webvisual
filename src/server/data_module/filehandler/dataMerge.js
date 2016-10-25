'use strict';

// Module exports
module.exports = processData;

// Process incoming Data

//  Parameters:
//    settings: configuration (dataConfig)
//    currentData: data (copywatch & state)
//      currentData.data <-- Array of Strings
//      currentData.state <-- Object of Boolean-Arrays
//  Return:
//    JSON-Object-Structure:
//      values: Object of:
//       [id] :  [ {"x":"..", "y":"..", "state":".."}, {..} , .. ] },
//			 [id..]: [...]

function processData(data, name, settings) {

	if (!Array.isArray(data) || settings === undefined) return; // Check for Existence

	// each Function Call new Variables
	var processedData = {},
		buffer = {},
		floatArrayView = {},
		state, id,
		maxDate = data[0].date || 0;

	var bufferLength = data.length * 8;

	// Join Data to the Object, which is used by the website
	var element;
	for (var i = 0; i < data.length; i++) {
		var k = 0;
		data[i].date = +(new Date(data[i].date));
		maxDate = +(new Date(Math.max(maxDate, data[i].date)));

		for (var j = 0; j < data[i].values.length; j++) {
			// head-data of measuring-points
			if (settings.ignore.indexOf(j) === -1 && k < settings.types.length) {
				// if it didn't exist before in process for return
				id = settings.types[k].id || settings.unnamedType.id + k;
				if (!processedData[id]) {
					processedData[id] = [];
				}
				// if (!buffer[id]) {
				// 	buffer[id] = {
				// 		x: new ArrayBuffer(bufferLength),
				// 		y: new ArrayBuffer(bufferLength)
				// 	};
				// 	floatArrayView[id] = {
				// 		x: new Float64Array(buffer[id].x),
				// 		y: new Float64Array(buffer[id].y)
				// 	}
				// }
				// floatArrayView[id].x[i] = data[i].date;
				// floatArrayView[id].y[i] = data[i].values[j];
				state = 0;
				if (data[i].values[j] !== null) {
					// exceeding
					if (settings.types[k].threshold !== undefined) {
						if (settings.types[k].threshold.from !== undefined &&
							data[i].values[j] < settings.types[k].threshold.from)
							state = -1;
						else if (settings.types[k].threshold.to !== undefined &&
							data[i].values[j] > settings.types[k].threshold.to)
							state = 1;
					}
				}
				// .data is the array, in which the measuring time, the value itself and an state-value is stored
				processedData[id].push({
					x: +(new Date(data[i].date)),
					y: data[i].values[j],
					state: state
				})
				k++;
			}
		}
	}

	return {
		values: processedData,
		// buffer: buffer,
		name: name,
		label: settings.label,
		date: maxDate
	};
}
