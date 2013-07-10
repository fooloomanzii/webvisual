(function(){
'use strict';

// Draw the graph
var currentData = undefined,
	valueArray  = [],
	dateArray   = [],
	tooltips    = [],
	day,
	line;

function createLabels() {
	dateArray = [];

	// The maximum amount of tooltips is 10; if the window gets smaller these amount is reduced.
	var maxTooltips = Math.min(10, Math.round($('#data').width()/100)),
		skip        = parseInt(currentData.length/maxTooltips, 10);

	// Save the dates in the dateArray; we want 10 dates max,
	// equally distributed over the available dates
	for(var i=currentData.length-1; i>0; i-=skip) {
		dateArray.unshift(moment(currentData[i].date).format("HH:mm:ss"));
	}
}

function arrangeData(data) {
	// Save the current data
	currentData = data;
	// Create a large enough array to store the values of each sensor
	valueArray = new Array(data[0].values.length);

	// Save the current day
	day = moment(data[0].date).format("DD-MMMM-YYYY");

	// Create the tooltips
	createLabels();

	// Get the values out of the data
	for(var i=0; i<valueArray.length; ++i) {
		valueArray[i] = [];
		// Get the last element and push it in the valueArray
		for(var k=0; k<data.length; ++k) {
			valueArray[i].push(data[k].values.pop());
		}
	}
	/*
		The first array of valueArray are now all first values (one sensor)
		of the data object. The first element of this array is the earliest
		value while the last one is the latest. We are able to draw multiple
		lines, for each sensor one, with this.
	*/

	// Make the tooltips
	tooltips = [];
	for(var i=0; i<valueArray.length; ++i) {
		for(var k=0; k<valueArray[i].length; ++k) {
			// Save the values in the tooltips
			tooltips.push(""+valueArray[i][k]);
		}
	}
}

$(document).ready(function() {
	// Set up the Socket.IO connection
	var socket = io.connect('http://'+window.location.host+'/data')
		.on('first', function(message) {
			if(message === undefined) return;

			arrangeData(message.data);

			// Create the graph
			line = new RGraph.Line("graph", valueArray)
				.Set('linewidth', 2)
				.Set('title', day)
				// .Set('title.xaxis.pos', .15)
				.Set('labels', dateArray)
				// .Set('gutter.bottom', 45)
				// .Set('text.size', 11)
				.Set('tickmarks', 'circle')
				.Set('tooltips', tooltips)
				.Set('ymax', 10)
				.Set('scale.round', true);

			// Save it in the graph namespace
			graphNS.graph = line;

			// Draw
			line.Draw();

			// Show the graph
			graphNS.showData();
		})
		.on('data', function(message) {
			if(message === undefined) return;

			arrangeData(message.data);

			// Update the graph
			line.original_data = valueArray;
			line.Set('labels', dateArray)
				.Set('title', day)
				.Set('tooltips', tooltips);

			// Redraw
			graphNS.redraw();
		});

	// Resize event; let the labels fit the page width
	graphNS.resize = function() {
		createLabels();
		line.Set('labels', dateArray);
	};
});

})();