$(document).ready(function() {
	var data = [280, 45, 133, 166, 84, 259, 266, 320, 219, 311, 67, 89];

	graphNS.graph = new RGraph.Bar('graph', data);
	graphNS.graph.Set('chart.labels', ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
	// graphNS.graph.Set('chart.gutter.left', 35);
	graphNS.graph.Draw();

	// Fade the data in
	graphNS.showData();
});