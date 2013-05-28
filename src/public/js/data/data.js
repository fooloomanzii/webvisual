$(document).ready(function(){
	// Options for animations
	var aOpt = {
		fadeSpeed: 300
	};
	// Initializing the data namespace to prevent interferences with the global namespace
	var dataNS = {
		// Toggle the view of the boxes
		toggleBox: function() {
			var start_box = $('#start-box'),
				graph_box = $('#graph-box'),
				first, second;

			// Fade the box first out, which is currently visible
			if(start_box.is(':visible')) {
				first = start_box;
				second = graph_box;
			} else {
				first = graph_box;
				second = start_box;
			}

			first.fadeToggle(aOpt.fadeSpeed, function() {
				second.fadeToggle(aOpt.fadeSpeed);
			});
		},
		// Returns the visible box type
		visibleBox: function() {
			var start_box = $('#start-box'),
				graph_box = $('#graph-box'),
				box;

			if(start_box.is(':visible')) {
				if(graph_box.is(':hidden')) box = 'start';
				else box = 'both';
			} else {
				if(graph_box.is(':visible')) box = 'graph';
				else box = 'none';
			}

			return box;
		},
		// Animate graph box
		animateGraphbox: function(execute) {
			var graph_box = $('#graph-box');

			graph_box.fadeOut(aOpt.fadeSpeed, function() {
				execute();

				graph_box.fadeIn(aOpt.fadeSpeed);
			});
		}
	};

	// Activate the hide-header function
	$('#hide-header').click(function() {
		// $('#header').slideUp('slow');
		$('#header').animate({
			height: 'hide',
			opacity: 'hide'
		}, 'slow');
		// $('#header').attr('hidden', '');
	});

	// Let the graph-links make an ajax call
	$('.graph-link').click(function() {
		// Don't make an AJAX request if the user clicked on the same link
		if(location.hash === $(this).attr('href')) return;

		// Get the graph type; remove the leading '#'
		var type      = $(this).attr('href').substr(1),
			start_box = $('#start-box'),
			graph_box = $('#graph-box'),
			visBox;

		visBox = dataNS.visibleBox();
		if(visBox === 'graph') {
			dataNS.animateGraphbox(function() {
				// Clear the graph_box and add the new content
				graph_box.empty();
				graph_box.load("/graphs/"+type);
			});
		} else if(visBox === 'start') {
			// Clear the graph_box and add the new content
			graph_box.empty();
			graph_box.load("/graphs/"+type);

			// Fade the start box out
			dataNS.toggleBox();
		}

		// Mark the choosen link/list-element active while removing active from the old element
		$('li.active').removeClass('active');
		$(this).parent('li').addClass('active');
	});

	// Let the start tab show the start-box
	$('#start').click(function() {
		if($('#start-box').is(':hidden')) dataNS.toggleBox();
		// Make current actice link/list-element inactive
		$('li.active').removeClass('active');
	});
});