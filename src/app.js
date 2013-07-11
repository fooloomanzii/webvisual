(function(){
'use strict';

/**
* Module dependencies
*/
var copywatch = require('./modules/copywatch'),
	routes    = require('./routes'),
	express   = require('express'),
	fs        = require('fs'),
// Default config
	def = {
		readFile: 'test.txt',
		writeFile: 'command.txt'
	},
// Other variables
	config      = require('./config.json'),
	defaultPort = 3000,
	logFile     = __dirname + '/log.txt',
	logMode,
	readFile    = config.readFile || def.readFile,
	writeFile   = config.writeFile || def.writeFile;

/**
* Configure the app
*/

var app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server);

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
		stream : fs.createWriteStream(logFile, {flags: 'a'})
	};
});

app.configure(function() {
	app.set('view engine', 'jade');
	app.set('view options', { layout: false });
	app.set('views', __dirname + '/views');
	//	Middleware compatibility
	app.use(express.bodyParser());
	//	Makes it possible to use app.get and app.delete, rather than use app.post all the time
	app.use(express.methodOverride());
	// Logging middleware
	// TODO: Dafuer sorgen, dass jede Verbindung nur einmal geloggt wird. Ergo: Irgendwie die statischen Dateien nicht loggen
	// app.use(express.logger(logMode));
	/*  Routes the requests, it would be implicit initialated at the first use of app.get
	this ensures that routing is done before the static folder is used */
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
	// Custom 404 page
	app.use(function(req, res) {
		res.status(404);

		// Respond with html page
		if(req.accepts('html')) {
			res.render('404', {
				status : 404,
				title  : 'Oops!'
			});
		}

	});
});

// Development config
app.configure('development', function() {
	// Make the Jade output readable
	app.locals.pretty = true;

	// Error Handler
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
* Socket.io Stuff
*/

// Just print warnings
io.set('log level', 1);

// User Counter
var userCounter = 0,
	currentData = undefined,
	firstSend,
// The data socket
	dataSocket = io.of('/data')
	.on('connection', function(socket) {
		// Increase the user counter on connection, if it is the first connection, start the watching of the file
		if(++userCounter === 1) {
			firstSend = true;
			copywatch.parsewatch(readFile, function(errorData, parsedData) {
				// Are there errors?
				if(errorData) {
					dataSocket.emit('error', {data: errorData});
				}
				// Then send the data

				var sendEvent = 'data';
				// Send the first event, if it is the first parsing
				if(firstSend) {
					sendEvent = 'first';
					firstSend = false;
				}
				// If something changes, then send the new data to the client
				// TODO: Implementiere eine Verarbeitung der Daten, sende nicht immer alles
				// TODO: Sende dem Client den Fehler, wenn einer auftritt
				currentData = parsedData;
				dataSocket.emit(sendEvent, {data: currentData});
			});
		}
		// The copywatch initialization makes a first parse right at the beginning.
		// This means, that just clients after the first need to get the current data
		else /*if(userCounter > 1)*/ {
			socket.emit('first', {data: currentData});
		}
	})
	.on('disconnet', function() {
		if(--userCounter === 0) {
			copywatch.unwatch(readFile);
			// Reset the firstSend bool
			firstSend = false;
		}
	})
	.on('log', function(message) {console.log("Message:", message);})
	.on('interrupt', function(message) {
		console.log('Test');
		fs.writeFile(writeFile, (message.command || "INTERRUPT"), 'utft8');
	});

/**
* Get it running!
*/

server.listen(process.env.PORT || defaultPort);

console.log("SemShow Server is running under %d Port in %s mode",
	(process.env.PORT || defaultPort), app.settings.env);

})();