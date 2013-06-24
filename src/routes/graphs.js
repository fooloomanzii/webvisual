(function(){
'use strict';

var fs = require('fs');
// Locals
var dir      = 'graphs/',
	graph404 = '404_graph.jade';

function graph(app) {
	app.get('/'+dir+':type', function(req, res) {
		var views   = app.get('views'),
			type    = req.params.type,
			path    = dir+type,
			jadeOpt = {
				type: type
			};

		// Check if the view exists, otherwise give a 404 message back
		if(!fs.existsSync(views+'/'+path+'.jade')) {
			path = dir+graph404;
		}

		res.render(path, jadeOpt);
	});
}

// Make the proper functions "public"
module.exports.graph = graph;

})();