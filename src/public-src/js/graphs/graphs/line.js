(function(){
'use strict';

// Draw the graph
var currentData,
	visualizeArray = [],
	valueArray     = [],
	dateArray      = [],
	tooltips       = [],
	visualizeState = [true],
	yMax = 10,
	day,
	line,
	colors = [
		'#f00', '#0f0', '#00f',
		'#f0f', '#ff0', '#0ff',
		'#000', '#949494', '#FFA600',
		'#008C10', '#FDBDFF', '#990000'
	];

/*
	Shows the linecountForm or an error if no data is there
*/
function linecountForm() {
	var graphsList = $('#linecount'),
		maxIndex;

	// Empty the current linecountList ...
	graphsList.empty();

	// ... and initialize it with elements
	if(valueArray.length > 0) {
		// Find the maximum index
		maxIndex = Math.min(valueArray.length, colors.length);

		for(var i=0; i<maxIndex; ++i) {
			graphsList.prepend('<label for="box'+(i+1)+'" class="countOption'+
				(i%6 != 0 ? ' float-right' : '')+'" style="margin-left:1em;">'+
				'<input type="checkbox" id="box'+(i+1)+'" style="display:none;"/>'+
				'<span class="custom checkbox'+
				(visualizeState[i] ? ' checked' : '')+
				'"></span> '+(i+1)+
				'</label>');
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
	for(var i=currentData.length-1; i>=0; i-=skip) {
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
		values on both ends of the data array and pick the maximum. */
	valueArray = new Array(Math.max(data[0].values.length, data[data.length-1].values.length));

	// Save the current day
	day = moment(data[0].date).format("DD-MMMM-YYYY");

	// Create the labels
	createLabels();

	var currVal;
	// Get the values out of the data
	// We need to iterate through the values array from behind, so we have the first values for the first graph
	for(var i=valueArray.length-1; i>=0; --i) {
		valueArray[i] = [];
		// Get the last element and push it in the valueArray
		for(var k=0; k<data.length; ++k) {
			currVal = data[k].values.pop();

			// Check if the current value is bigger than the max val
			if(currVal > yMax) yMax = 2*yMax;

			valueArray[i].push(currVal);
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
		tooltips[i] = [];
		for(var k=0; k<valueArray[i].length; ++k) {
			// Save the values in the tooltips
			tooltips[i].push(""+valueArray[i][k]);
		}
	}
}

// This function returns the proper tooltip for the graph
// Index is the index of the tooltip of the visible graphs starting at 0
function getTooltip(index) {
	var curr;

	// We have to find the tooltip from the tooltips of the visible graphs, so we have to skip the invisible ones
	for(var i=0; i<tooltips.length; ++i) {
		// Check if the graph is visible; if not then skip this one
		if(!visualizeState[i]) continue;

		// Save the current array for easier handling
		curr = tooltips[i];

		// If index is smaller than the length of the current tooltip array, we have reached the correct graph
		if(index < curr.length) return curr[index];

		// If not, we reduce the index
		index -= curr.length;
	}

	// We didn't find a tooltip, so we return nothing
}

// READY
$(document).ready(function() {
	// Local variables
	var button_text = {
		"interrupt": "Interrupt",
		"continue": "Continue"
	},
	// Set up the Socket.IO connection
		socket = io.connect('http://'+window.location.host+'/data', {transports: ['xhr-polling']});

	// Some functions
	function flipButton() {
		var newText = button_text.interrupt,
			button = $('#interruptButton');

		if(button.text() === button_text.interrupt) {
			newText = button_text.continue;
		}

		button.text(newText);
	}

	// First message
	socket.on('first', function(message) {
		if(message === undefined) return;

		// Arrange the data
		arrangeData(message.data);

		// Initialise the linecount button
		linecountForm();

		// Create the graph
		line = new RGraph.Line("graph", visualizeArray)
			.Set('colors', ['#f00', '#0f0', '#00f', '#f0f', '#ff0', '#0ff', '#000', '#949494', '#FFA600', '#008C10', '#FDBDFF', '#990000'])
			.Set('linewidth', 2)
			.Set('title', day)
			// .Set('title.xaxis.pos', .15)
			.Set('labels', dateArray)
			// .Set('gutter.bottom', 45)
			// .Set('text.size', 11)
			.Set('tickmarks', 'circle')
			.Set('tooltips', getTooltip)
			.Set('ymax', yMax)
			.Set('scale.round', true);

		// Save it in the graph namespace
		graphNS.graph = line;

		// Draw
		line.Draw();

		// Set the interrupt button text
		$('#interruptButton').text(message.state ? button_text.interrupt : button_text.continue);

		// Show the graph
		graphNS.showData();
	});
	// New data event
	socket.on('data', function(message) {
		if(message === undefined) return;

		// Arrange the data
		arrangeData(message.data);

		// Initialise the linecount button
		linecountForm();

		// Update the graph
		line.original_data = visualizeArray;
		line.Set('labels', dateArray)
			.Set('title', day)
			.Set('ymax', yMax);

		// Redraw
		graphNS.redraw();
	});
	// Command event; occures on an interrupt and a continue
	socket.on('command', function(message) {
		if(message === undefined || message.cmd === undefined) return;

		// The the button text
		if(message.cmd === "interrupt" || message.cmd === "continue") {
			flipButton();
		}
	});

	// Interrupt button
	$('#interruptButton').click(function() {
		var command;
		if($(this).text() === button_text.interrupt) {
			command = 'interrupt';
		} else {
			command = 'continue';
		}

		// Emit the command
		socket.emit('command', {cmd: command});
	});

	// Resize event; let the labels fit the page width
	graphNS.resize = function() {
		createLabels();
		line.Set('labels', dateArray);
	};
});

})();