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
	watchers      = {},
	watcherCount  = 0,
	extension     = '_node',
	// newline    = ((process.platform === 'win32' || process.platform === 'win64') ? '\r\n' : '\n');
	newline       = require('os').EOL, // OS specific newline character
	// Save the OTHER newline ... actually some server use \n\r but this can be ignored here
	alternativeNL = (newline === '\n' ? '\r\n' : '\n'),
	errorFile     = './copywatch.err';

// Functions

/*
	Default errorhandler
*/
function errorHandler(err) {
	if (err) {
		if (typechecker.isArray(err) && err.length === 0) {
			return;
		}
		console.error("An error occured:", err);
	}
}

/*
	checkMode
*/
function checkMode(mode) {
	if (!(mode === 'end' || mode === 'begin' || mode === 'all')) {
		throw "Not a valid mode.";
	}
}

/*
	Create read/write options
*/
function createOptions(start, end) {
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
function copy(path, start, end, parse_options, callback) {
	var options = createOptions(start, end);

	// Give the callback the parsed data, if they are defined
	if(parsed_options && callback) {
		parseRead(path, start, end, parse_options, callback);
	}

	fs.createReadStream(path, options.readOptions).pipe(fs.createWriteStream(path+extension, options.writeOptions));
}

/*
	Parseandcopy
	Parses and copys a file with the data_parser-module.
*/
function parsecopy(path, start, end, parse_options, callback) {
	if (typeof start === 'object' && parse_options) parse_options = start;
	else if (typeof end === 'object' && parse_options) parse_options = end;

	// Define Variables
	var options, write;

	// Create the read/write options
	options = createOptions(start, end);

	options.writeOptions.encoding = 'utf8';

	function end(parsedData) {
		// Init the write stream
		write = fs.createWriteStream(path+extension, options.writeOptions);

		// var writeString = "";
		// // To reduce the write operations, we create a big string with all the data
		// for(var i=0; i<parsedData.length; ++i) {
		// 	writeString += JSON.stringify(parsedData[i]) + newline;
		// }
		var writestring = JSON.stringify(parsedData);

		// Write the data and close the stream
		write.end(writeString);

		// Make the callback
		if(callback) callback(parsedData);
	}

	parseRead(path, options.readOptions, end);
}

function parseRead(path, start, end, parse_options, callback) {
	// Define variables
	var parsedData = [], read, readOptions;

	// Check for alternative parameters
	if(typeof start === 'object') {
		readOptions = start;
	} else {
		readOptions = createOptions(start, end).readOptions;
	}

	if(typeof end === 'function') {
		callback = end;
	}

	readOptions.encoding = 'utf8';

	read = fs.createReadStream(path, readOptions);

	read.on('error', function(err) {
		// TODO: Implement errorhandling
	});


	// We don't want to create functions in loops
	function pushData(err, data) {
		if(err)	{
			// TODO: Errorhandling
			// fs.writeFile(errorFile, ((new Date())+": "+err), {flag: 'a'});
			console.error(err.message, err.lineNumber);
		} else {
			parsedData.push(data);
		}
	}

	var tmpBuffer = "", firstRead = true;
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
			}
		}
	});

	read.on('end', function() {
		// We still need to add the last stored line in tmpBuffer, if there is one
		if(tmpBuffer !== "") {
			parser.parse(tmpBuffer, 'unknown', parse_options, pushData);
		}

		if(callback) callback(parsedData);
	});
}

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

		if (remove) return fs.unlink(path+extension, (callback || errorHandler));
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
			return (callback || errorHandler)(errors.length>0 ? errors : null);
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
	mode influences the copy/parse mechanism which is used, when the file was updated:
		'end' - copy the last bytes of the file (the difference between prevStat.size and currStat.size)
		'begin' - copy the first few bytes of the file (the difference between prevStat.size and currStat.size)
		'all' - copy the whole file
	options
		copy_function - a string which describes which function should be used to make a copy of the file
			'default' - the default, copywatch makes a simple copy
			'parse' - copywatch will create a parsed copy of the file
			'none' - the file won't be copied.
				You still can give copywatch a parse_callback-function, which will recieve the parsed data.
				If there is not parse_callback-function than copywatch won't watch the file, since there is no point in doing so.
		parse_callback - a function which recieves the parsed data, when the file was changed
*/
function watch(mode, files, options, next) {
	// Define variables
	var i, process_function, listenersObj, nextObj;

	checkMode(mode);

	process_function = copy;
	// Are there any options
	if (typeof options === 'function' && typeof next === 'undefined') {
		next = options;
	} else if (options !== null && typeof options === 'object') {
		// Copyparse option
		if(options.copy_function === 'parse') {
			process_function = parsecopy;
		} // None option
		else if(options.copy_function === 'none') {
			if(options.parse_callback) {
				// Just parse the file and give the data to the specified callback
				process_function = parseRead;
			} else {
				// There is no point in doing nothing on a change
				return;
			}
		}
	}

	if (!typechecker.isArray(files)) {
		files = [files];
	}

	// Make a first copy
	for (i=0; i<files.length; ++i) {
		process_function(files[i], undefined, undefined, options.parse_options, options.parse_callback);
	}

	// We don't want to define functions inside a loop
	listenersObj = {
		log: function (logLevel) {
			if (logLevel === 'dev') {
				console.log("Log:", arguments);
			}
		},
		error: errorHandler,
		change: function (event, path, currStat, prevStat) {
			// Update event - copy the changes
			if (event === 'update') {
				if (mode === 'end') {
					process_function(path, prevStat.size, undefined, options.parse_options, options.parse_callback);
				} else if (mode === 'begin') {
					process_function(path, 0, (currStat.size - prevStat.size), options.parse_options, options.parse_callback);
				} else if (mode === 'all') {
					process_function(path, undefined, undefined, options.parse_options, options.parse_callback);
				}
			}
			//  Delete event - delete the copied version
			else if (event === 'delete') {
				fs.unlink(path+extension, errorHandler);
			}
		}
	};

	nextObj = function (err, watcherInstance) {
		++watcherCount;

		// Execute the next function
		if (next) return next(err);
	};

	// Iterate through the files and create a watcher for each
	for (i=0; i<files.length; ++i) {
		watchers[path_util.resolve(files[i])] = watchr.watch({
			path: files[i],
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
	watch        : watch,
	parsewatch   : parsewatch,
	unwatch      : unwatch,
	clear        : clear,
	setExtension : setExtension,
	getExtension : getExtension
};

// 'use static'-end
})();