(function(){
'use strict';

var fs   = require('fs'),
	path = require('path'),
	config = require('../config/config.json');

/**
 * Route function
 */
function route(route_path, json_obj) {
	json_obj.path = "/" + route_path;

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
	graph404 = path.join(graphs, '../404_graph.jade'),
	tables   = path.join(views, 'tables/tables'),
	table404 = path.join(tables, '../404_table.jade');

// Graphs routing
exports.graph = function(req, res) {
	var jadeOpt = {
			path: req.url,
			title: 'Graph'
		},
		jadeFile = path.join(graphs, 'graph')+'.jade';

	// Deliver the specified graph
	if(req.query.type) {
		// Modify the jadeFile
		jadeFile = path.join(graphs, req.query.type)+'.jade';

		// Modify the title
		if (req.query.type=="graph"){
			jadeOpt.title = "Graph";
		} else {
			jadeOpt.title = jadeOpt.title + " - "
			+ req.query.type.charAt(0).toUpperCase()
			+ req.query.type.slice(1);
		}

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

//Tables routing
exports.table = function(req, res) {
	var jadeOpt = {
			path: req.url,
			title: (config.locals&&config.locals.table&&config.locals.table.title)?
					(config.locals.table.title):'Datatable'
		},
		jadeFile = path.join(tables, 'table')+'.jade';

	// Deliver the specified table
	if(req.query.type) {
		// Modify the jadeFile
		jadeFile = path.join(tables, req.query.type)+'.jade';

		// Modify the jade object
		jadeOpt.type = req.query.type;

		// Check if the view exists, otherwise render a 404 message
		if(!fs.existsSync(jadeFile)) {
			res.status(404);
			jadeFile = table404;
		}
	}

	// Render the page
	res.render(jadeFile, jadeOpt);
};

})();