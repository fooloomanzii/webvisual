/**
* Module dependencies
*/
var copywatch = require('./modules/copywatch'),
	graph     = require('./modules/graphs'),
	// parser    = require('./modules/data_parser'),
	routes    = require('./routes'),
	express   = require('express');

var defaultPort = 3000;

/**
* Configure the app
*/

var app = express();

var logMode;
// Logging
// Development
app.configure('development', function() {
	// In development mode write the development log in stdout
	logMode = 'dev';
});
// Production
app.configure('production', function() {
	// Otherwise write it in a seperate file
	logMode = {
		format : 'default',
		stream : __dirname + 'log.txt'
	};
});

app.configure(function() {
	app.set('view engine', 'jade');
	app.set('views', __dirname + '/views');
	// Logging middleware
	app.use(express.logger(logMode));
	//	Middleware compatibility
	app.use(express.bodyParser());
	//	Makes it possible to use app.get and app.delete, rather than use app.post all the time
	app.use(express.methodOverride());
	/*  Routes the requests, it would be implicit initialated at the first use of app.get
	this ensures that routing is done before the static folder is used */
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
	// Custom 404 page
	app.use(function(req, res) {
		res.render('404', {
			status : 404,
			title  : 'Oops!'
		});
	});
});

// Error handler
// Development
app.configure('development', function() {
	app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});

/**
* Routing
*/

app.get(['/', '/home', '/index'], routes.index);
app.get('/data', routes.data);

/**
 * "Add" the graphs routing
 */

graph.graph(app);

/**
* Get it running!
*/

var server = app.listen(process.env.PORT || defaultPort);

console.log("SemShow Server is running under %d Port in %s mode",
	(process.env.PORT || defaultPort), app.settings.env);