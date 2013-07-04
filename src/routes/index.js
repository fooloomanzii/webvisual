(function(){
'use strict';

var fs = require('fs');

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
var dir      = 'graphs/graphs/',
	views    = __dirname + '/../views',
	graph404 = '../404_graph.jade';

// Graphs routing
exports.data = function(req, res) {
	var jadeOpt = {
			currentURL: '/data',
			title: 'Data'
		},
		path = 'data';

	// Deliver the specified graph
	if(req.query.type) {
		// Modify the path
		path = dir+req.query.type;

		// Modify the jade object
		jadeOpt.type = req.query.type;

		// Check if the view exists, otherwise render a 404 message
		if(!fs.existsSync(views+'/'+path+'.jade')) {
			res.status(404);
			path = dir+graph404;
		}
	}

	// Render the page
	res.render(path, jadeOpt);
};

})();