var copywatch = require('../modules/copywatch');

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

// Data
exports.data = route('data', {title: 'Data', values: [undefined, undefined, undefined]});

// Graphs
exports.graphs = route('graphs', {title: 'Graphs'});