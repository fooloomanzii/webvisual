(function(){
'use strict';

var fs   = require('fs'),
	path = require('path');

/**
 * Route function
 */
function route(route_path, json_obj) {
	json_obj.currentURL = "/" + route_path;

	return function(req, res)
	{
		res.render(route_path, json_obj);
	};
}

// Home
exports.index = route('index', { title: 'Home' });

// Data and Graphs
// Locals
var views    = path.join(__dirname, '../views'),
	graphs   = path.join(views, 'graphs/graphs'),
	graph404 = path.join(graphs, '../404_graph.jade');

// Graphs routing
exports.data = function(req, res) {
	var jadeOpt = {
			currentURL: '/data',
			title: 'Data'
		},
		jadeFile = 'data';

	// Deliver the specified graph
	if(req.query.type) {
		// Modify the jadeFile
		jadeFile = path.join(graphs, req.query.type)+'.jade';

		// Modify the title
		jadeOpt.title = jadeOpt.title + " - "
			+ req.query.type.charAt(0).toUpperCase()
			+ req.query.type.slice(1);

		// Modify the jade object
		jadeOpt.type = req.query.type;

		// Check if the view exists, otherwise render a 404 message
		if(!fs.existsSync(jadeFile)) {
			res.status(404);
			jadeFile = graph404;
		}
	}

	// Render the page
	res.render(jadeFile, jadeOpt);
};

})();