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
		read_file: 'test.txt',
		command_file: 'command.txt',
		port: 3000,
	},
// Other variables
	config      = require('./config.json'),
	logFile     = __dirname + '/log.txt',
	logMode,
	port        = config.port || def.port,
	read_file    = config.read_file || def.read_file,
	command_file = config.command_file || def.command_file,
// Command object
	cmd_txt = {
		"interrupt": (config.cmd && config.cmd.interrupt) || "INTERRUPT",
		"continue": (config.cmd && config.cmd.continue) || "CONTINUE"
	};

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

// Socket variables
var userCounter = 0,
	currentData,
	firstSend,
// Checks if the interrupt order is set
	state = (fs.existsSync(command_file) && (fs.readFileSync(command_file, 'utf8') !== cmd_txt.interrupt)),
// A set of commands which can be executed when the command event is fired; the cmd_tmp is used to asign the same function to multiple elements
	cmd_tmp, cmd_fnct = {
		"interrupt": (cmd_tmp = function(socket, command) {
			// Write an interrupt command into the command_file; emits an error to the calling client if something goes wrong
			fs.writeFile(command_file, cmd_txt[command], 'utf8', function(err) {
				if(err) {
					socket.emit('error', {data: err});
					return;
				} state = (command !== "interrupt");
			});

			// TODO: Emit an change event to the other clients notice that the state has changed
			dataSocket.emit('command', {cmd: command});
		}),
		"continue": cmd_tmp
	},
// The data socket
	dataSocket = io.of('/data').on('connection', function(socket) {
		// Initialize the other events
		// Reduces the usercounter and stops the watching of the file if necessary
		socket.on('disconnect', function() {
			if(--userCounter === 0) {
				copywatch.unwatch(read_file);
				// Reset the firstSend bool
				firstSend = false;
			}
		});

		// Listen for the command event
		socket.on('command', function(message) {
			if(message === undefined || message.cmd === undefined) {
				return;
			}

			var command = message.cmd.toLowerCase();
			// Execute the given command
			if(cmd_fnct[command]) cmd_fnct[command](socket, command);
		});

		// Increase the user counter on connection, if it is the first connection, start the watching of the file
		if(++userCounter === 1) {
			firstSend = true;
			copywatch.parsewatch(read_file, function(errorData, parsedData) {
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
				currentData = parsedData;
				dataSocket.emit(sendEvent, {data: currentData});
			});
		}
		// The copywatch initialization makes a first parse right at the beginning.
		// This means, that just clients after the first need to get the current data
		else /*if(userCounter > 1)*/ {
			socket.emit('first', {data: currentData, state: state});
		}
	});

/**
* Get it running!
*/

server.listen(process.env.PORT || port);

console.log("SemShow Server is running under %d Port in %s mode",
	(process.env.PORT || port), app.settings.env);

})();