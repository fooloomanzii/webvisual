/**
* Module dependencies
*/
var copywatch = require('module/copywatch'),
	parser = require('module/data_parser'),
	express = require('express');

var defaultPort = 3000;

/**
* Configure the app
*/

var app = express();

app.configure(function()
{
	app.set('view engine', 'jade');
	app.set('views', __dirname + '/views');

	//	Middleware compatibility
	app.use(express.bodyPaser());
	//	Makes it possible to use app.get and app.delete, rather than use app.post all the time
	app.use(express.methodOverride());
	/*  Routes the requests, it would be implicit initialated at the first use of app.get
	this ensures that routing is done before the static folder is used */
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});

/**
* Starting the app in development mode
*/

app.configure('development', function()
{
	app.use(express.logger('dev'));
	app.use(express.errorHandler());
});

/**
* Routing
*/

function route(route_path, json_obj) 
{
	json_obj.currentURL = "/" + route_path;

	return function(req, res) 
	{
		res.render(route_path, json_obj);
	};
}

app.get('/', route('index', { title: 'Home' }));
app.get('/home', route('index', { title: 'Home' }));
app.get('/index', route('index', { title: 'Home' }));

/**
* Get it running!
*/

var server = app.listen(process.env.PORT || defaultPort);

console.log("SemShow Server is running under %d Port in %s mode",
	(process.env.PORT || defaultPort), app.settings.env);