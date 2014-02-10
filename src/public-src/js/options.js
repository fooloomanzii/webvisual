(function(){
	'use strict';

	$(document).ready(function() {
		// Local variables
		var button_text = {
			"off": "Off",
			"on": "On"
		},
		// Set up the Socket.IO connection
		optSocket = io.connect('http://'+window.location.host+'/options');
		
		// Rearranges the table with states of funktions.
		function arrangeStates(states) {
			for (var state in states){
				$('#funcTBody').append('<tr id="'+state+'">'+
						'<td class="funcName">'+state+'</td>'+
						'<td><a value="'+state+'" class="custom state button">'+(states[state]?'Off':'On')+'</a></td>'+
						'<td><div>'+(states[state]?'On':'Off')+'</div></td>'+
						'</tr>');
			}
		
			$(".state").on('click', function(e) {
				var command;
				if($(this).text() === button_text.off) {
					command = [$(this).attr('value'),'off'];
				} else {
					command = [$(this).attr('value'),'on'];
				}
		
				// Emit the command
				optSocket.emit('command', {cmd: command});
			});
		}
		
		//Flips the Button
		function flipButton(cmd) {
			var button = $('#'+cmd[0]+' a'),
				state = $('#'+cmd[0]+' div');
	
			if(cmd[1] === "off") {
				button.text(button_text.on);
				state.text(button_text.off);
			} else {
				button.text(button_text.off);
				state.text(button_text.on);
			}
		}
		
		// Receive the data
		optSocket.on('data', function(message) {
			if(message === undefined) return;
			// Arrange the Table with states of functions
			arrangeStates(message.states);	
		});
		
		// Command event; occurs on an 'on' or 'off'
		optSocket.on('command', function(message) {
			if(message === undefined || message.cmd === undefined) return;
	
			// The the button text
			if(message.cmd[1] === "off" || message.cmd[1] === "on") {
				flipButton(message.cmd);
			}
		});
		
		/*$("#optionsButton").on('click', function(e) {		
			$("#optModal").reveal();
		});*/
	});

})();