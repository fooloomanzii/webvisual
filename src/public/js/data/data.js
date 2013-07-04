(function(){
'use strict';

$(document).ready(function() {
	var dataNamespace = (function() {

	var firstCall = true,
		socket = io.connect('http://'+window.location.host+'/data')
			.on('data', function(data) {
				data = data.data;

				if((!data  && data !== null) || data.length < 1) {
					return;
				}

				// Use the last entry of the array; this is arbitrary
				var values = data.pop().values;

				// First call?
				// Create the list
				if(firstCall) {
					firstCall = false;

					for(var i=0; i<values.length; ++i) {
						$('#namen').append('<h3 class="subheader">Messwert '+(i+1)+':</h3>');
						$('#werte').append('<h3 id="value'+i+'">');
					}

					// Hide the loading message
					$('#load').fadeOut(undefined, function() {
						// Show the data
						$('#data').fadeIn();
					});
				}

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