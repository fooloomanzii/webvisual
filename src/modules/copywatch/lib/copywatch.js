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

// Require
var	fs = require('fs'),
	typechecker = require('typechecker'),
	watchr = require('watchr');

// Global variables
var watchers = {};
var watcherCount = 0;
var extension = '_node';

// Functions
/*	The watch function
	mode influences the copy mechanism which is used, when the file was updated:
		'end' - copy the last bytes of the file (the difference between prevStat.size and currStat.size)
		'begin' - copy the first few bytes of the file (the difference between prevStat.size and currStat.size)
		'all' - copy the whole file */
function watch(mode, files, options, next) {
	if(!(mode == 'end' || mode == 'begin' || mode == 'all')) {
		throw "Not a valid mode.";
	}

	// Are there any options
	

	if(!typechecker.isArray(files)) {
		files = new Array(files);
	}
	// this.files = files;

	// Make a first copy
	for(var i=0; i<files.length; ++i) {
		copy(files[i]);
	}

	// Iterate through the files and create a watcher for each
	for(var i=0; i<files.length; ++i) {
		watchers[files[i]] = watchr.watch({
			path: files[i],
			listeners: {
				log: function(logLevel) {
					if(logLevel == 'dev') {
						console.log("Log:", arguments);
					}
				},
				error: errorHandler,
				change: function(event, path, currStat, prevStat) {
					// Update event - copy the changes
					if(event == 'update') {
						if(mode == 'end') {
							copy(path, prevStat.size);
						} else if(mode == 'begin') {
							copy(path, 0, (currStat.size - prevStat.size));
						} else if(mode == 'all') {
							copy(path);
						}
					}
					//  Delete event - delete the copied version
					else if(event == 'delete') {
						fs.unlink(path+extension, errorHandler);
					}
				}
			},
			next: function(err, watcherInstance) {
				++watcherCount;

				// Execute the next function
				if(next) return next(err);
			}
		});
	}
}

/* Copy a file. start and end are optional */
function copy(path, start, end) {
	// Copys the file
	if(start && end) {
		fs.createReadStream(path, {start: start, end: end}).pipe(fs.createWriteStream(path+extension, {start: start, flags: 'a'}));
	} else if(start) {		
		fs.createReadStream(path, {start: start}).pipe(fs.createWriteStream(path+extension, {start: start, flags: 'a'}));
	} else {
		fs.createReadStream(path).pipe(fs.createWriteStream(path+extension));
	}
}

/* Unwatch a file
		path - path to the file
		remove - bool value: delete the copy version, or leave it? */
function unwatch(path, remove, callback) {
	if(watchers[path] != null) {
		watchers[path].close;
		watcherCount--;
		
		delete watchers[path];

		if(remove) return fs.unlink(path+extension, (callback ? callback : errorHandler));
		else return callback();
	}
}

/*	Unwatch for every watcher, when all watchers are closed the callback is called with a array of potential errors
		remove - bool value: delete the copy versions, or leave them?
		callback - callback function, gets an array of potential errors */
function clear(remove, callback) {
	var errors = new Array();

	for(var path in watchers) {
		unwatch(path, remove, function(err) {
			if(err) errors.push(err);

			/*	When all watchers are destroyed, call the callback.
				If there is no callback, call the default handler.
				If there are no errors and no callback, do nothing. */
			if(watcherCount == 0) return (callback ? callback : errorHandler)(errors.length>0 ? errors : null);
		});
	}
}

/*	Set the extension for the copied files */
function setExtension(newExtension) {
	// Rename the old files
	for(path in watchers) {
		fs.renameSync(path+extension, path+newExtension);
	}

	extension = newExtension;
}
/*	Get the current extension */
function getExtension() {
	return extension;
}

function errorHandler(err) {
	if (err) {
		if(typechecker.isArray(err) && err.length == 0) {
			return;
		}
		console.error("An error occured:", err);
	}
}

// Exported functions
module.exports.watch = watch;
module.exports.unwatch = unwatch;
module.exports.clear = clear;
module.exports.setExtension = setExtension;
module.exports.getExtension = getExtension;