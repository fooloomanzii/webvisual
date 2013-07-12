(function(){
'use strict';

$(document).ready(function() {
	var dataNS = (function() {

	// Return the values out of the data object
	function getValues(data) {
		data = data.data;

		if((!data  && data !== null) || data.length < 1) {
			return;
		}

		// Use the last entry of the array; this is arbitrary
		return data.pop().values;
	}

	var socket = io.connect('http://'+window.location.host+'/data')
	// The first data
	socket.on('first', function(data) {
		var values = getValues(data);
		if(values === undefined) return;

		// Create the table
		for(var i=0; i<values.length; ++i) {
			$('#namen').append('<h3 class="subheader">Messwert '+(i+1)+':</h3>');
			$('#werte').append('<h3 id="value'+i+'">'+values[i]+'</h3>');
		}

		// Hide the loading message
		$('#load').fadeOut(undefined, function() {
			// Show the data
			$('#data').fadeIn();
		});
	});
	socket.on('data', function(data) {
		var values = getValues(data);
		if(values === undefined) return;

		// Change the values
		for(var i=0; i<values.length; ++i) {
			$('#value'+i).text(values[i]);
		}
	});



	// Public stuff
	return {
			socket: socket
		};

	})();
});

})();