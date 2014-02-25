(function() {
'use strict';

	var newline       = /\r\n|\n\r|\n/; // Every possible newline character
	var udpsocket = require('dgram').createSocket('udp4');

	udpsocket.on('listening', function() {
		var address = udpsocket.address();
			console.log('server listening on ' + address.address + ':' + address.port );
	});
	
	function watch(port, options) {
		
		udpsocket.on('message', function(message, info) {
			
			if(message === '') return;
			
			var processedData = [], errorData     = [], tmpBuffer = "", linecount = 0, data = '';
			
			// We don't want to create functions in loops
			function pushData(err, data) {
				if(err)	{ // null == undefined => true; this is used here
					errorData.push({
						port: info.port,
						lineNumber: linecount,
						error: err
					});
				} else {
					processedData.push(data);
				}
			}
			
			data+=message;
			
			var tokens = data.split(newline);
			// No multiple lines? Then we just read a partial line, add it to the buffer and return.
			if(tokens.length === 1) {
				tmpBuffer += tokens[0];
			} else {
				
				// It is possible, that the last "line" of the data isn't complete. So we have to store it and wait for the next readable event
				// Complete the first tokens element with the stored data ...
				tokens[0] = tmpBuffer + tokens[0];
				// ... and saves the last element for the next time
				tmpBuffer = tokens.pop();
	
				// Process every line on their own
				for(var i=0; i<tokens.length; ++i) {
					// Skip empty lines
					if(tokens[i].length > 0) options.process(tokens[i], pushData);
					// Increase the linecount
					++linecount;
				}
			}
			
			// We still need to add the last stored line in tmpBuffer, if there is one
			if(tmpBuffer !== "") {
				options.process(tmpBuffer, pushData);
			}	

			// Are there any errors?
			if(errorData.length === 0) errorData = null;

			if(options.content) options.content(errorData, processedData);
			
			console.log('server got message from ' + info.address + ':' + info.port);
			});
		udpsocket.bind(port);
	}
	
	// Exported functions
	module.exports = {
		// Public
		watch        : watch,
	};

})();