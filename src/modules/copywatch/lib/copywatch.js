// WATCHR DOKU
/*
user watcher with watchr.watch(config). Available configurations are:
	path - a single path to watch
	paths - an array of paths to watch
	listener - a single change listener to fire when a change occurs
	listeners - an array of listeners to fire when a change occurs, overloaded to accept the following values:
		changeListener a single change listener
		[changeListener] - an array of change listeners
		{eventName:eventListener} - an object keyed with the event names and valued with a single event listener
		{eventName:[eventListener]} - an object keyed with the event names and valued with an array of event listeners
	next - (optional, defaults to null) a completion callback to fire once the watcher have been setup, arguments are:
		when using the path configuration option: err, watcherInstance
		when using the paths configuration option: err, [watcherInstance,...]
	stat - (optional, defaults to null) a file stat object to use for the path, instead of fetching a new one
	interval - (optional, defaults to 5007) for systems that poll to detect file changes, how often should it poll in millseconds
	persistent - (optional, defaults to true) whether or not we should keep the node process alive for as long as files are still being watched
	duplicateDelay - (optional, defaults to 1000) sometimes events will fire really fast, this delay is set in place so we don't fire the same event within the timespan. Set to falsey to perform no duplicate detection.
	preferredMethods - (optional, defaults to ['watch','watchFile']) which order should we prefer our watching methods to be tried?
	ignorePaths - (optional, defaults to false) an array of full paths to ignore
	ignoreHiddenFiles - (optional, defaults to false) whether or not to ignored files which filename starts with a .
	ignoreCommonPatterns - (optional, defaults to true) whether or not to ignore common undesirable file patterns (e.g. .svn, .git, .DS_Store, thumbs.db, etc)
	ignoreCustomPatterns - (optional, defaults to null) any custom ignore patterns that you would also like to ignore along with the common patterns

The following events are available to your via the listeners:

	log - for debugging, receives the arguments logLevel ,args...
	error - for gracefully listening to error events, receives the arguments err
		you should always have an error listener, otherwise node.js's behavior is to throw the error and possibly crash your application, see #40
	watching - for when watching of the path has completed, receives the arguments err, isWatching
	change - for listening to change events, receives the arguments changeType, fullPath, currentStat, previousStat, received arguments will be:
		for updated files: 'update', fullPath, currentStat, previousStat
		for created files: 'create', fullPath, currentStat, null
		for deleted files: 'delete', fullPath, null, previousStat

The function returns a watcher instance or a array of watcher if multiple paths were given
*/

// Make the library strict
// Strict mode, pretty similar to C's -Wall compile option
(function() {
'use strict';

// Require
var fs          = require('fs'),
	path_util   = require('path'),
	parser      = require('../../data_parser'),
	typechecker = require('typechecker'),
	watchr      = require('watchr'),

// Global variables
	def           = {
		copy_function: _copy,
		error_handler: _error_handler
	},
	watchers      = {},
	watcherCount  = 0,
	extension     = '_node',
	// newline    = ((process.platform === 'win32' || process.platform === 'win64') ? '\r\n' : '\n');
	newline       = require('os').EOL, // OS specific newline character
	// Save the OTHER newline ... actually some server use \n\r but this can be ignored here
	alternativeNL = (newline === '\n' ? '\r\n' : '\n'),
	errorFile     = './copywatch.err';

// PRIVATE

/*
	Default error_handler
*/
function _error_handler(err) {
	if (err) {
		if (typechecker.isArray(err) && err.length === 0) {
			return;
		}
		console.error("An error occured:", err);
	}
}

/*
	Checks if the given mode is valid.
	Returns a boolean.
*/
function _check_mode(mode) {
	if (!(mode === 'end' || mode === 'begin' || mode === 'all')) {
		throw new Error(mode+" - Not a valid mode.");
	}
}

/*
	Create read/write options
*/
function _file_options(start, end) {
	var options = {
		readOptions: {},
		writeOptions: {}
	};

	// Create the options for reading and writing
	if (start && end) {
		options.readOptions = {start: start, end: end};
		options.writeOptions = {start: start, flags: 'a'};
	}

	return options;
}

/*
	Copy
	Copys a file. start and end are optional
*/
function _copy(path, start, end, parse_options, callback) {
	var options = _file_options(start, end);

	fs.createReadStream(path, options.readOptions).pipe(fs.createWriteStream(path+extension, options.writeOptions));
}

/*
	Parseandcopy
	Parses and copys a file with the data_parser-module.
*/
function _parse_copy(path, start, end, parse_options, callback) {
	if (typeof start === 'object' && parse_options) parse_options = start;
	else if (typeof end === 'object' && parse_options) parse_options = end;

	// Define Variables
	var options, write;

	// Create the read/write options
	options = _file_options(start, end);

	options.writeOptions.encoding = 'utf8';

	function finish(errorData, parsedData) {
		// Init the write stream
		write = fs.createWriteStream(path+extension, options.writeOptions);

		var writestring = JSON.stringify(parsedData);

		// Write the data and close the stream
		write.end(writeString);

		// Make the callback
		if(callback) callback(errorData, parsedData);
	}

	_parse_read(path, options.readOptions, finish);
}

function _parse_read(path, start, end, parse_options, callback) {
	// Define variables
	var parsedData = [],
		errorData  = [],
		read, readOptions;

	// Check for alternative parameters
	if(typeof start === 'object') {
		readOptions = start;
	} else {
		readOptions = _file_options(start, end).readOptions;
	}

	if(typeof end === 'function') {
		callback = end;
	}

	// Set the encoding
	readOptions.encoding = 'utf8';

	// Create the readstream
	read = fs.createReadStream(path, readOptions);

	read.on('error', function(err) {
		throw new Error("An error occured while reading the file '"+path+"'.\nDetails: "+err);
	});


	// We don't want to create functions in loops
	function pushData(err, data) {
		if(err)	{
			errorData.push({
				file: path,
				lineNumber: linecount,
				error: err
			});
		} else {
			parsedData.push(data);
		}
	}

	// Reading the stream
	var tmpBuffer = "", firstRead = true, linecount = 0;
	read.on('readable', function() {
		var data = read.read();

		// Split the data
		var tokens = data.split(newline);
		// Split the string again with the alternative newline, if the OS newline didn't work
		if(tokens.length === 1) tokens = tokens[0].split(alternativeNL);

		// It is possible, that the last "line" of the data isn't complete. So we have to store it and wait for the next readable event
		if(firstRead) {
			tmpBuffer = tokens.pop();
			firstRead = false;
		} else {
			// Completes the first tokens element with the stored data from last time ...
			tokens[0] = tmpBuffer + tokens[0];
			// ... and saves the last element for the next time
			tmpBuffer = tokens.pop();
		}

		// Parse every line on their own
		for(var i=0; i<tokens.length; ++i) {
			if(tokens[i].length > 2) {
				parser.parse(tokens[i], 'unknown', parse_options, pushData);
				// Increase the linecount
				++linecount;
			}
		}
	});

	// End the stream
	read.on('end', function() {
		// We still need to add the last stored line in tmpBuffer, if there is one
		if(tmpBuffer !== "") {
			parser.parse(tmpBuffer, 'unknown', parse_options, pushData);
		}

		// Are there any errors?
		if(errorData.length === 0) errorData = undefined;

		if(callback) callback(errorData, parsedData);
	});
}

/*
	Handle the watch options
*/
function _create_watch_options(mode, options) {
	var processed_options = {
		mode: mode,
		error_handler: def.error_handler,
		process_function: def.copy_function,
		parse_callback: options.parse_callback
	};

	// Are there any options
	if (options !== null && typeof options === 'object') { // typeof null === 'object'; yes, it's dumb
		// Copyfunction option
		if(options.copy_function === 'parse') {
			processed_options.process_function = _parse_copy;
		} // None option
		else if(options.copy_function === 'none') {
			if(options.parse_callback) {
				// Just parse the file and give the data to the specified callback
				processed_options.process_function = _parse_read;
			} else {
				/*	There is no point in doing nothing on a change.	This probably
				wasn't the users intention and failing quitly would just confuse. */
				throw new Error("Configuration error."+
					"The options specify that copywatch should do nothing on a change,"+
					" so then there is no point in watching the file. "+
					"This can't be your intention.");
			}
		}

		// Error handler option
		if(typeof options.error_handler === 'function') {
			processed_options.error_handler = options.error_handler;
		}
	}

	return processed_options;
}

/*
	Handles a valid change event.
*/
function _handle_change(event, path, currStat, prevStat, options) {
	// Update/create event - process the changes
	if (event === 'update' || event === 'create') {
		if (options.mode === 'end') {
			options.process_function(path, prevStat.size, undefined, options.parse_options, options.parse_callback);
		} else if (options.mode === 'begin') {
			options.process_function(path, 0, (currStat.size - prevStat.size), options.parse_options, options.parse_callback);
		} else if (options.mode === 'all') {
			options.process_function(path, undefined, undefined, options.parse_options, options.parse_callback);
		}
	}
	//  Delete event - delete the copied version
	else if (event === 'delete') {
		// We don't need to delete the copied file if there is no copied file
		if(options.copy_function !== 'none') {
			fs.unlink(path+extension, _error_handler);
		}
	}
}

/*
	Create the listeners object
*/
function _create_listeners(options) {
	return {
		// The log listener; logs all given arguments except the logLevel on stdout
		log: function (logLevel) {
			if (logLevel === 'dev') {
				console.log("Log:", arguments.slice(1));
			}
		},
		// The error_handler, it is specified in the options object
		error: options.error_handler,
		change: function (event, path, currStat, prevStat) {
			// If its an event for a file we don't watch, there is no reason to process it
			if(watchers[path] === undefined) return;

			_handle_change(event, path, currStat, prevStat, options);
		}
	};
}

/*
	Create the next object
*/

// PUBLIC

/*
	Unwatch a file
		path - path to the file
		remove - bool value: delete the copy version, or leave it?
*/
function unwatch(path, remove, callback) {
	// Make the path an absolute path
	path = path_util.resolve(path);
	if (watchers[path] !== undefined) {
		watchers[path].close();
		watcherCount--;

		delete watchers[path];

		if (remove) return fs.unlink(path+extension, (callback || _error_handler));
		else if (callback) return callback();
	}
}

/*
	Unwatch for every watcher, when all watchers are closed the callback is called with a array of potential errors
		remove - bool value: delete the copy versions, or leave them?
		callback - callback function, gets an array of potential errors
*/
function clear(remove, callback) {
	var errors = [], path, handler;

	// We don't want to define functions in loops
	handler = function (err) {
		if (err) errors.push(err);

		/*	When all watchers are destroyed, call the callback.
			If there is no callback, call the default handler.
			If there are no errors and no callback, do nothing. */
		if (watcherCount === 0) {
			return (callback || _error_handler)(errors.length>0 ? errors : null);
		}
	};

	for (path in watchers) {
		if(watchers.hasOwnProperty(path)) {
			unwatch(path, remove, handler);
		}
	}
}

/*	Set the extension for the copied files */
function setExtension(newExtension) {
	var path;

	// Rename the old files
	for (path in watchers) {
		if(watchers.hasOwnProperty(path)) {
			fs.renameSync(path+extension, path+newExtension);
		}
	}

	extension = newExtension;
}
/*	Get the current extension */
function getExtension() {
	return extension;
}

/*
	Watch
	mode - mode influences the copy/parse mechanism which is used, when the file was updated:
		'end' - copy the last bytes of the file (the difference between prevStat.size and currStat.size)
		'begin' - copy the first few bytes of the file (the difference between prevStat.size and currStat.size)
		'all' - copy the whole file
	files - the file or an array of files which should be watched
	options
		copy_function - a string which describes which function should be used to make a copy of the file
			'default' - the default, copywatch makes a simple copy
			'parse' - copywatch will create a parsed copy of the file
			'none' - the file won't be copied.
				You still can give copywatch a parse_callback-function, which will recieve the parsed data.
				If there is not parse_callback-function than copywatch will throw an error, since there is
				no point in watching a file and doing nothing on change.
		error_handler - a function which is called when an error occures
		parse_callback - a function which recieves the parsed data, when the file was changed
*/
function watch(mode, files, options, next) {
	// Define variables
	var i, listenersObj, nextObj;

	// Check if the given mode is a valid one
	_check_mode(mode);

	// Process the options; use default values if necessary
	options = _create_watch_options(mode, options);

	// Make sure that files are an array (important for later processing)
	if (!typechecker.isArray(files)) {
		files = [files];
	}

	// We don't want to define functions inside a loop
	listenersObj = _create_listeners(options);

	// The object with the function that will be executed after the watcher was correctly configured
	nextObj = function (err, watcherInstance) {
		++watcherCount;

		// Execute the next function
		if (next) return next(err);
	};

	// HACK!
	/*	Since we don't want the watchr to stop watching when the file is deleted,
		we watch the whole directory while ignoring all the files we don't want to watch.
		It's a bit ugly but won't mean performance descrease while running, since watchr
		still just watches just the one file. If it's a big directory the startup speed
		can	suffer a bit, but it shoudln't be too bad. */
	// Iterate through the files and create a watcher for each
	var currFile, currDir,
		// The function that is called, when the existance of the file is known
		exists_callback = function(exists) {
			if(exists === false) {
				console.warn('"'+currFile+'"', "was not found.\n"+
					"copywatch now listens for the \"create\"-event and will watch as specified afterwards.");
			} else {
				// Make a first copy/parse
				options.process_function(currFile, undefined, undefined, options.parse_options, options.parse_callback);
			}
		};

	// Looping through the given files
	for (i=0; i<files.length; ++i) {
		currFile = path_util.resolve(files[i]); // Necessary to have the file in scope of the "readdir"-function; files[i] doesn't work
		currDir  = path_util.dirname(currFile);

		// Check for existance and make a first copy/parse
		fs.exists(currFile, exists_callback);

		// Finally watch the file
		watchers[currFile] = watchr.watch({
			path: currDir, // We need to watch the directory in order to not stop watching on delete
			listeners: listenersObj,
			next: nextObj
		});
	}
}

/*
	Parsewatch
	Equivalent to watch('all', files, {copy_function: 'none', parse_callback: parse_callback}, next)
*/
function parsewatch(files, parse_callback, next) {
	watch('all', files, {copy_function: 'none', parse_callback: parse_callback}, next);
}

// Exported functions
module.exports = {
	// Private
	_error_handler: _error_handler,
	_check_mode: _check_mode,
	_file_options: _file_options,
	_copy: _copy,
	_parse_copy: _parse_copy,
	_parse_read: _parse_read,
	_create_watch_options: _create_watch_options,
	_handle_change: _handle_change,
	_create_listeners: _create_listeners,
	// Public
	watch        : watch,
	parsewatch   : parsewatch,
	unwatch      : unwatch,
	clear        : clear,
	setExtension : setExtension,
	getExtension : getExtension
};

// 'use static'-end
})();