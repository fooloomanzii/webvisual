(function(){
	'use strict';

	$(document).ready(function() {
		var s1NS = (function() {

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
				for(var i=0; i<parseInt(values.length/2, 10); ++i) {
					jQuery('<h3 />', {'class': 'subheader', 'text': 'Messwerte '+(i+1)}).appendTo('#namen');
					jQuery('<h3 />', {'id': 'value'+(i*2), text: values[i*2]}).appendTo('#werte1');
					jQuery('<h3 />', {'id': 'value'+(i*2+1), text: values[i*2+1]}).appendTo('#werte2');
				}

				// Hide the loading message
				$('#load').fadeOut(undefined, function() {
					// Show the data
					$('#data').fadeIn();
				});
			})
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