(function(){
'use strict';

var fs   = require('fs'),
	path = require('path');

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

//Tables routing
exports.table = function(req, res) {
	var jadeOpt = {
			path: req.url,
			title: 'Table'
		},
		jadeFile = path.join(tables, 'table')+'.jade';

	// Deliver the specified graph
	if(req.query.type) {
		// Modify the jadeFile
		jadeFile = path.join(tables, 'table'+req.query.type)+'.jade';

		// Modify the title
		if(req.query.type=="2"){
			jadeOpt.title = "2 Cols Table";
		} else if (req.query.type=="Select"){
			jadeOpt.title = "Table with select option";
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
			jadeFile = table404;
		}
	}

	// Render the page
	res.render(jadeFile, jadeOpt);
};

})();