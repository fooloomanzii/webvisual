(function(){
'use strict';

/**
* Module dependencies
*/
var copywatch = require('./modules/copywatch'),
	parser    = require('./modules/data_parser'),
	routes    = require('./routes'),
	express   = require('express'),
	fs        = require('fs'),
// Default config
	def = {
		read_file: 'data.txt',
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
		"off": ((config.cmd && config.cmd.off) ? config.cmd.off : "OFF"),
		"on": ((config.cmd && config.cmd.on) ? config.cmd.on : "ON")
	},
// Function that receives errors
	errfunc = function(err) {
		if(err) {
			console.log('error');
			socket.emit('error', {data: err});
			return;
		}
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
app.get('/graph', routes.graph);
app.get('/table', routes.table);

/**
* Socket.io Stuff
*/

// Just print warnings
io.set('log level', 1);

// Socket variables
var userCounter = 0,
	currentData,
	firstSend,
	states={},
// Checks the funktions_file for new funktions and command_file for avaliable states
	checkstates = function() {
		var stt_tmp={},
			line_tmp;
			
		for(var i in config.functions) {
			states[config.functions[i]]=true;
		}
		fs.readFile(command_file, 'utf8', function (err, data){
			if(err) errfunc(err);
			data.toString().split(/\r\n|\r|\n/).forEach(function (line) {
				if(line=="") return;
				line_tmp=line.split(':');
				if(line_tmp.length!=2) return;
				stt_tmp[line_tmp[0]]=line_tmp[1];
			})
		});
		fs.writeFile(command_file, "", function(err){
			if(err) errfunc(err);
		});
		for(var element in states) {
			if(stt_tmp[element]) states[element]=(stt_tmp[element] !== cmd_txt.off);		
			fs.appendFile(command_file, element+":"+(states[element]?cmd_txt.on:cmd_txt.off)+'\r\n', 'utf8', function(err){
				if(err) errfunc(err);
			});
		}
	},
// A set of commands which can be executed when the command event is fired; the cmd_tmp is used to asign the same function to multiple elements
	cmd_tmp, cmd_fnct = {
		"off": (cmd_tmp = function(socket, command) {
			// Write an command into the command_file 
			states[command[0]] = (command[1] !== "off");
			fs.writeFile(command_file, "", function(err){
				if(err) errfunc(err);
			});
			for(var element in states) {
				fs.appendFile(command_file, element+":"+(states[element]?cmd_txt.on:cmd_txt.off)+'\r\n', 'utf8', function(err){
					if(err) errfunc(err);
				});
			}
			// Emits the command so the other notice that something happened
			optionsSocket.emit('command', {cmd: command});
		}),
		"on": cmd_tmp
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
// The data socket
	dataSocket = io.of('/data').on('connection', function(socket) {
		// Initialize the other events
		// Reduces the usercounter and stops the watching of the file if necessary
		socket.on('disconnect', function() {
			if(--userCounter === 0) {
				copywatch.unwatch(read_file);

				// Log
				console.log("Stopped watching \""+read_file+"\"");

				// Reset the firstSend bool
				firstSend = false;
			}
		});

		// Increase the user counter on connection, if it is the first connection, start the watching of the file
		if(++userCounter === 1) {
			firstSend = true;
			// Start watching the file
			copywatch.watch('all', read_file, {
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
			console.log("Started watching \""+read_file+"\"");
		}
		// The copywatch initialization makes a first parse right at the beginning.
		// This means, that just clients after the first need to get the current data
		else /*if(userCounter > 1)*/ {
			socket.emit('first', {data: currentData});
		}
	});

/**
* Get it running!
*/
checkstates();

server.listen(port);

console.log("Server is running under %d Port in %s mode",
	port, app.settings.env);

})();