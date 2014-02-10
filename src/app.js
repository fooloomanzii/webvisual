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
<<<<<<< HEAD
		data_file: 'data.txt',
		command_file: 'commands.json',
=======
		connections: [ 'file' ],
		read_file: 'data.txt',
		command_file: 'command.txt',
>>>>>>> upstream/data
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
<<<<<<< HEAD
	port        = config.port || defaults.port,
	data_file    = config.data_file || defaults.data_file,
	command_file = config.command_file || defaults.command_file,
	commands,
=======
	threshhold = _.defaults(require('./config/threshhold.json'), threshholdDefaults),
>>>>>>> upstream/data
// Command object
	cmd_txt = {
		"on": ((config.states && config.states[0]) ? config.states[0] : "ON"),
		"off": ((config.states && config.states[1]) ? config.states[1] : "OFF")
	},
// Function that receives errors
	errfunc = function(err,socket) {
		console.log('error');
		socket.emit('error', {data: err});
		return;
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
var userCounter = 0,
	currentData,
	firstSend,
	states={},
// Checks the funktions_file for new functions and command_file for available states; 
// reading synchonusly isn't a problem here, since this just happens on startup
	checkstates = function() {
		fs.exists(command_file, function(exists) {
			if (!exists) {
				console.log("File '"+command_file+"' don't exists. This file will be created");
				fs.writeFile(command_file, "", function(err2){
					if(err2) errfunc(err2,socket);
				});
			}
		});			
		commands = JSON.parse(fs.readFileSync(command_file, 'utf8', function (err) {
			  if (err) {
				  console.log("Can't read file ''"+command_file+"'");
				  errfunc(err,socket);
			  }
		}));
		if(!commands.functions){
			commands.functions={};
		}		
		for(var func in config.functions) {
			if(commands.functions[func]){
				states[func]=(commands.functions[func] !== cmd_txt.off);
			} else {
				states[func]=(config.functions[func] !== cmd_txt.off);
				commands.functions[func]=(states[func]?cmd_txt.on:cmd_txt.off);
			}
		}
		
		fs.writeFile(command_file, JSON.stringify(commands, null, "\t"), function(err){
			if(err) errfunc(err,socket);
		});
	},
// A set of commands which can be executed when the command event is fired; the cmd_onoff is used to assign the same function to multiple elements
	cmd_onoff, cmd_fnct = {
		"off": (cmd_onoff = function(socket, command) {
			//Changes the state
			states[command[0]] = (command[1] !== "off");			
			// Write an command into the config
			commands.functions[command[0]]=command[1];	
			fs.writeFile(command_file, JSON.stringify(commands, null, "\t"), function(err){
				if(err) errfunc(err,socket);
			});
			// Emits the command so the other notice that something happened
			optionsSocket.emit('command', {cmd: command});
		}),
		"on": cmd_onoff
	},
// The options socket
	optionsSocket = io.of('/options').on('connection', function(socket) {
		// Listen for the command event
		socket.on('command', function(message) {
			if(message === undefined || message.cmd === undefined) {
				return;
			}
			var command = message.cmd;
			// Execute the given command
			
			if(cmd_fnct[command[1]]) cmd_fnct[command[1]](socket, command);
		});
		
		// Send the data
		socket.emit('data', {states: states});		
	}),
// The config socket
	configSocket = io.of('/config').on('connection', function(socket){
		socket.emit('data', {locals: config.locals});	
	}),
// The data socket
	dataSocket = io.of('/data').on('connection', function(socket) {
		// Initialize the other events
		// Reduces the usercounter and stops the watching of the file if necessary
		socket.on('disconnect', function() {
			if(--userCounter === 0) {
				copywatch.unwatch(data_file);

				// Log
				console.log("Stopped watching \""+data_file+"\"");

				// Reset the firstSend bool
				firstSend = false;
			}
		});

		// Increase the user counter on connection, if it is the first connection, start the watching of the file
		if(++userCounter === 1) {
			firstSend = true;
			// Start watching the file
			copywatch.watch('all', data_file, {
				copy: false, // We don't need to make a copy of the file
				process: parser.parse, // The used parse function
				content: function(errorData, parsedData) {
					// Are there errors?
					if(errorData) {
						console.warn("Error(s) occured:", errorData);
						dataSocket.emit('error', {data: errorData});
					}

					// Create the event type and the message object
					var sendEvent = 'data',
						message   = {
							data: parsedData
						};

					// Set the first event and add the state, if it is the first parsing
					if(firstSend) {
						sendEvent = 'first';
						firstSend = false;
					}

					// Save the new data and ...
					currentData = parsedData;

					// ... finally send the data
					dataSocket.emit(sendEvent, message);
				}
			});

			// Log
			console.log("Started watching \""+data_file+"\"");
		}
		// The copywatch initialization makes a first parse right at the beginning.
		// This means, that just clients after the first need to get the current data
		else /*if(userCounter > 1)*/ {
			socket.emit('first', {data: currentData});
		}
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

checkstates();
server.listen(port);

console.log("Server is running under %d Port in %s mode",
	port, app.settings.env);
