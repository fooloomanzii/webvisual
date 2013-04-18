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
var	parser = require('data_parser'),
	fs = require('fs'),
	typechecker = require('typechecker'),
	watchr = require('watchr'),

// Global variables
	watchers = {},
	watcherCount = 0,
	extension = '_node',
	linebreak = ((process.platform === 'win32' || process.platform === 'win64') ? '\r\n' : '\n');

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
	Copy 
	Copys a file. start and end are optional
*/
function copy(path, start, end) {
	var readOptions = {}, writeOptions = {};
	// Copys the file
	if (typeof start !== 'undefined' && typeof end !== 'undefined') {
		readOptions = {start: start, end: end};
		writeOptions = {start: start, flags: 'a'};
	} else if (typeof start !== 'undefined') {
		readOptions = {start: start};
		writeOptions = {start: start, flags: 'a'};
	}

	fs.createReadStream(path, readOptions).pipe(fs.createWriteStream(path+extension, writeOptions));
}

/* 
	Parseandcopy
	Parses and copys a file with the data_parser-module.
*/
function parsecopy(path, start, end, parse_options) {
	if (typeof start === 'object' && typeof parse_options === 'undefined') parse_options = start;
	else if (typeof end === 'object' && typeof parse_options === 'undefined') parse_options = end;

	// Define Variables
	var readOptions = {}, writeOptions = {}, read, write, i;

	// Copys the file
	if (typeof start !== 'undefined' && typeof end !== 'undefined') {
		readOptions = {start: start, end: end};
		writeOptions = {start: start, flags: 'a'};
	} else if (typeof start !== 'undefined') {
		readOptions = {start: start};
		writeOptions = {start: start, flags: 'a'};
	}

	readOptions.encoding = 'utf8';
	writeOptions.encoding = 'utf8';

	read = fs.createReadStream(path, readOptions);
	write = fs.createWriteStream(path+extension, writeOptions);

	read.on('data', function(data) {
		var tokens = data.split(linebreak);

		// We don't want to create functions in loops
		function writeData(err, data) {
			if(err)	{
				console.log(err);
			} else {
				write.write(JSON.stringify(data) + "\n");
			}
		}

		// Parse every line on their own
		for(i=0; i<tokens.length; ++i) {
			if(tokens[i].length > 1) {
				parser.parse(tokens[i], 'unknown', parse_options, writeData);
			}
		}
	});
}

/* Unwatch a file
		path - path to the file
		remove - bool value: delete the copy version, or leave it? */
function unwatch(path, remove, callback) {
	if (watchers[path] !== null) {
		watchers[path].close();
		watcherCount--;

		delete watchers[path];

		if (remove) return fs.unlink(path+extension, (callback || errorHandler));
		else return callback();
	}
}

/*	Unwatch for every watcher, when all watchers are closed the callback is called with a array of potential errors
		remove - bool value: delete the copy versions, or leave them?
		callback - callback function, gets an array of potential errors */
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
	mode influences the copy mechanism which is used, when the file was updated:
		'end' - copy the last bytes of the file (the difference between prevStat.size and currStat.size)
		'begin' - copy the first few bytes of the file (the difference between prevStat.size and currStat.size)
		'all' - copy the whole file
*/
function watch(mode, files, options, next) {
	// Define variables
	var i, copyfunction, listenersObj, nextObj;

	if (!(mode === 'end' || mode === 'begin' || mode === 'all')) {
		throw "Not a valid mode.";
	}

	copyfunction = copy;
	// Are there any options
	if (typeof options === 'function' && typeof next === 'undefined') {
		next = options;
	} else if (options !== null && typeof options === 'object' && options.parse === true) {
		// Parse option
		copyfunction = parsecopy;
	}

	if (!typechecker.isArray(files)) {
		files = [files];
	}

	// Make a first copy
	for (i=0; i<files.length; ++i) {
		copyfunction(files[i]);
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
					copyfunction(path, prevStat.size, undefined, options.parse_options);
				} else if (mode === 'begin') {
					copyfunction(path, 0, (currStat.size - prevStat.size), options.parse_options);
				} else if (mode === 'all') {
					copyfunction(path, undefined, undefined, options.parse_options);
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
		watchers[files[i]] = watchr.watch({
			path: files[i],
			listeners: listenersObj,
			next: nextObj
		});
	}
}

// Exported functions
module.exports.watch = watch;
module.exports.unwatch = unwatch;
module.exports.clear = clear;
module.exports.setExtension = setExtension;
module.exports.getExtension = getExtension;

// 'use static'-end
})();