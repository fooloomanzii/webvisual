'use strict';

/**
 * Module dependencies
 */

var dataModule = require('./data'),
	routes     = require('./routes'),
	express    = require('express'),
	fs         = require('fs'),
	_          = require('underscore'),
// Class variables
	DataChecker = dataModule.DataChecker,
	DataHandler = dataModule.DataHandler,
// Default config
	defaults = {
		connections: [ 'file' ],
		read_file: 'data.txt',
		command_file: 'command.txt',
		port: 3000,
	},
	threshholdDefaults = {
		file: {
			max: 5,
			min: -10
		}
	},
// Other variables
	checker = {},
// Configuration, uses default values, if necessary
	config     = _.defaults(require('./config/config.json'), defaults),
	logFile    = __dirname + '/log.txt',
	logMode,
	threshhold = _.defaults(require('./config/threshhold.json'), threshholdDefaults),
// Command object
	cmd_txt = {
		"interrupt": ((config.cmd && config.cmd.interrupt) ? config.cmd.interrupt : "INTERRUPT"),
		"continue": ((config.cmd && config.cmd.continue) ? config.cmd.continue : "CONTINUE")
	};

/**
 * Extend Underscore
 */
_.mixin({
	exclone: function(object, extra) {
		return _(object).chain().clone().extend(extra).value();
	}
});

/**
 * Configure the app
 */

var app    = express(),
	server = require('http').createServer(app),
	io     = require('socket.io').listen(server);

// Development
app.configure('development', function() {
	// Make the Jade output readable
	app.locals.pretty = true;

	// Error Handler
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack:      true
	}));

	// In development mode write the development log in stdout
	logMode = 'dev';

	// Make the Jade output readable and add the environment specification
	_.extend(app.locals, {
		env:    'development',
		pretty: true,
	});


	// Error Handler
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack:      true
	}));
});

// Production
app.configure('production', function() {
	// In production mode write the log in a seperate file
	logMode = {
		format: 'default',
		stream: fs.createWriteStream(logFile, {flags: 'a'})
	};

	// Set the environment specification for jade
	app.locals.env = 'production';
});

app.configure(function() {
	app.set('view engine', 'jade');
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
				status: 404,
				title:  'Oops!'
			});
		}

	});
});


/**
 * Routing
 */

app.get(['/', '/home', '/index'], routes.index);
app.get('/graph', routes.graph);
app.get('/table', routes.table);

/**
 * Initialise the different DataChecker
 */
_(config.connections).each(function(value) {
	checker[value] = new DataChecker(threshhold[value]);
});

/**
* Configure Socket.io
*/

// Just print warnings
io.set('log level', 1);

// Socket variables
var currentData = null,
// Checks if the interrupt order is set; reading synchonusly isn't a problem here, since this just happens on startup
	state = (fs.existsSync(config.command_file) && (fs.readFileSync(config.command_file, 'utf8') !== cmd_txt.interrupt)),
// A set of commands which can be executed when the command event is fired; the cmd_tmp is used to asign the same function to multiple elements
	cmd_tmp, cmd_fnct = {
		"interrupt": (cmd_tmp = function(socket, command) {
			// Write an interrupt command into the command_file; emits an error to the calling client if something goes wrong
			fs.writeFile(config.command_file, cmd_txt[command], 'utf8', function(err) {
				if(err) {
					socket.emit('error', {data: err});
					return;
				} state = (command !== "interrupt");
			});

			// Emits the command so the other notice that something happened
			dataSocket.emit('command', {cmd: command});
		}),
		"continue": cmd_tmp
	},
// The data socket
	dataSocket = io.of('/data').on('connection', function(socket) {
		// Listen for the command event
		socket.on('command', function(message) {
			if(message === undefined || message.cmd === undefined) {
				return;
			}

			var command = message.cmd.toLowerCase();
			// Execute the given command
			if(cmd_fnct[command]) cmd_fnct[command](socket, command);
		});

		// Send a first data set
		socket.emit('first', {
			data:  currentData,
			state: state
		});
	});


/**
 * Establish data connection
 */
var connections = new DataHandler({
	// Use the default configuration
	connection: config.connections,
	listener: {
		data: [

			// SocketIO Listener
			function(type, data) {
				// Save the current data
				currentData = data;

				// Send it
				dataSocket.emit('data', { data: data });
			}
		]
	}
});

/**
 * Get it running!
 */

server.listen(config.port);

console.log("Server is running under %d Port in %s mode",
	config.port, app.settings.env);
