(function(){
	'use strict';

	$(document).ready(function() {

		var s2NS = (function() {

			// Return the values out of the data object
			function getValues(data) {
				data = data.data;

				if((!data  && data !== null) || data.length < 1) {
					return;
				}

				// Use the last entry of the array; this is arbitrary
				return data.pop().values;
			}

			var values;
			var socket = io.connect('http://'+window.location.host+'/data');
			// The first data
			socket.on('first', function(data) {
				values = getValues(data);
				if(values === undefined) return;

				$('#sel').customSelect();
				// Create the table
				for(var i=0; i<parseInt(values.length/2, 10); ++i) {
					$('#sel').append(jQuery('<option />', {'value': i, text: 'Wert '+(i+1)}));
				}

				// Trigger the change to show the values at start
				$('#sel option').eq(0).prop('selected', true);
				$('#sel').trigger('change');
				

				// Hide the loading message
				$('#load').fadeOut(undefined, function() {
					// Show the data
					$('#data').fadeIn();
				});
			});

			// Next data
			socket.on('data', function(data) {
				values = getValues(data);
				if(values === undefined) return;

				// Set new values
				var i = $('#sel').val()*2;
				$('#value'+i).text(values[i++]);
				$('#value'+i).text(values[i]);
			});
			
			// Handle the Dropdown selection
			$('#sel').on('change', function (e) {
				var i = $(this).val();
				$('#werte').html(jQuery('<h3 />', {'id': 'value'+(i*2), 'text': values[i*2]}));
				jQuery('<h3 />', {'id': 'value'+(i*2+1), 'text': values[i*2+1]}).appendTo('#werte');
			});

			// Public stuff
			return {
				socket: socket
			};

		})();
	});

})();