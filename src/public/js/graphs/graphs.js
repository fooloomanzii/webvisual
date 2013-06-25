// Graphs namespace
graphNS = (function() {
// Canvas and contexts
var can = document.getElementById('graph'),
	cxt = can.getContext('2d'),
	graph = $('#graph');

$(document).ready(function(){
	// Resize the canvas
	$(window).resize(function() {
		graphNS.graphResize();
		redraw();
	});

	// Activate the hide-header function
	$('#hide-header').click(function() {
		$('#header').animate({
			height: 'hide',
			opacity: 'hide'
		}, 'slow');
	});
});

function redraw() {
	if(graphNS.graph === undefined) return;

	// Clear the canvas
	cxt.clearRect(0, 0, can.width, can.height);

	// Draw the graph
	graphNS.graph.Draw();
}

// Sets the width of the canvas
function setWidth(width) {
	if(graph) graph.attr('width', width);
}
// Sets the height of the canvas
function setHeight(height) {
	if(graph) graph.attr('height', height);
}

function defaultResize() {
	setWidth($('#canvasDiv').width());
	setHeight($('#canvasDiv').width()/2);
}

return {
	graph: undefined,
	graphResize: defaultResize,
	redraw: redraw,
	setWidth: setWidth,
	setHeight: setHeight,
};

})();