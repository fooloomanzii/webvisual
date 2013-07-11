(function(){
'use strict';

// Draw the graph
var currentData,
	visualizeArray = [],
	valueArray     = [],
	dateArray      = [],
	tooltips       = [],
	visualizeState = [true],
	day,
	line;

/*
	Shows the linecountForm or an error if no data is there
*/
function linecountForm() {
	var graphsList = $('#linecount');

	// Empty the current linecountList ...
	graphsList.empty();

	// ... and initialize it with elements
	if(valueArray.length > 0) {
		for(var i=0; i<valueArray.length; ++i) {
			graphsList.prepend('<label for="box'+(i+1)+'" class="countOption float-right" style="margin-left:1em;">'+
				'<input type="checkbox" id="box'+(i+1)+'" style="display:none;"/>'+
				'<span class="custom checkbox'+
				(visualizeState[i] ? ' checked' : '')+
				'"></span> '+(i+1)+
				'</label>')
		} $('.countOption').click(function() {
			// Get the currently selected value
			var box = parseInt($(this).text(), 10);

			// Switch the state
			visualizeState[box-1] = !visualizeState[box-1];

			// Create the visualization array
			initializeVisualizationArray();

			// Update the graph
			line.original_data = visualizeArray;

			// Redraw
			graphNS.redraw();
		});

		// Show the form and hide the error
		$('#linecountForm').removeClass('hidden');
		$('#noDataLabel').addClass('hidden');
	} else {
		// Hide the form and show the error
		$('#linecountForm').addClass('hidden');
		$('#noDataLabel').removeClass('hidden');
	}
}

/*
	Creates the labels for the graph, depending on the width of the screen
*/
function createLabels() {
	dateArray = [];

	// The maximum amount of tooltips is 10; if the window gets smaller these amount is reduced.
	var maxTooltips = Math.min(10, Math.round($('#data').width()/100)),
		skip        = Math.max(1, Math.round(currentData.length/maxTooltips));

	// Save the dates in the dateArray; we want 10 dates max,
	// equally distributed over the available dates
	for(var i=currentData.length-1; i>0; i-=skip) {
		dateArray.unshift(moment(currentData[i].date).format("HH:mm:ss"));
	}
}

/*
	Set the values in the vizualisation array.
*/
function initializeVisualizationArray() {
	var tmp;

	visualizeArray = [];
	// Place the values in the vizualization array
	for(var i=0; i<valueArray.length; ++i) {
		// Just visualize when the checkbox is checked
		if(visualizeState[i]) {
			tmp = valueArray[i];
		} else {
			tmp = [];
		}

		visualizeArray.push(tmp);
	}
}

/*
	Rearranges the data, so it can be properly visualized in a line graph.
*/
function arrangeData(data) {
	if(data === undefined || data.length === 0) return;
	// Save the current data
	currentData = data;
	/*	Create a large enough array to store the values of each sensor;
		since there can "pop up" new values from a new sensor at any time,
		or old ones disappear, it is necessary to check for the amount of
		values on both endes of the data array and pick the maximum. */
	valueArray = new Array(Math.max(data[0].values.length, data[data.length-1].values.length));

	// Save the current day
	day = moment(data[0].date).format("DD-MMMM-YYYY");

	// Create the labels
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

	// Initialize the visualizeState array
	var curr;
	for(var i = 1; i<valueArray.length; ++i) {
		if(visualizeState[i] === undefined) visualizeState[i] = false;
	}

	// Init the vizualisation array
	initializeVisualizationArray();

	// Make the tooltips
	tooltips = [];
	for(var i=0; i<valueArray.length; ++i) {
		for(var k=0; k<valueArray[i].length; ++k) {
			// Save the values in the tooltips
			tooltips.push(""+valueArray[i][k]);
		}
	}
}


// READY
$(document).ready(function() {
	// Set up the Socket.IO connection
	var socket = io.connect('http://'+window.location.host+'/data', {transports: ['xhr-polling']})
		.on('first', function(message) {
			if(message === undefined) return;

			// Arrange the data
			arrangeData(message.data);

			// Initialise the linecount button
			linecountForm();

			// Create the graph
			line = new RGraph.Line("graph", visualizeArray)
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

			// Arrange the data
			arrangeData(message.data);

			// Initialise the linecount button
			linecountForm();

			// Update the graph
			line.original_data = visualizeArray;
			line.Set('labels', dateArray)
				.Set('title', day)
				.Set('tooltips', tooltips);

			// Redraw
			graphNS.redraw();
		});


	// Interrupt button
	$('#interruptButton').click(function() {
		console.log('test');
		// socket.emit('interrupt', {command: "INTERRUPT"});
		socket.send('interrupt');
	});

	// Resize event; let the labels fit the page width
	graphNS.resize = function() {
		createLabels();
		line.Set('labels', dateArray);
	};
});

})();