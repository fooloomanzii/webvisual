//(function() {
'use strict';

// Require
var parser      = require('../../data_parser'),
  typechecker = require('typechecker'),

// "Global" variables
  _default    = {
    firstCopy: true,
    process: function(string, callback) {
      callback(null, string);
    },
    work_function: _process_copy,
    watch_error: _error_handler
  },
  _watchers     = {},
  _watcherCount = 0,
  _extension    = '_node',
  newline       = /\r\n|\n\r|\n/, // Every possible newline character
  errorFile     = './udp.err';

var udpsocket = require('dgram').createSocket('udp4');

udpsocket.on('message', function(message, rinfo) {
  console.log('server got message: "' + message + '" from ' + rinfo.address + ':' + rinfo.port);
  });
udpsocket.on('listening', function() {
  var address = udpsocket.address();
    console.log('server listening on ' + address.address + ':' + address.port );
});

udpsocket.bind(4000);

// Functions

// PRIVATE

/*
  Default error_handler
*/
function _error_handler(err) {
  if (err) {
    if (typechecker.isArray(err) && err.length === 0) {
      return;
    }
    console.error("An error occured: ", err);
  }
}

/*
  Checks if the given mode is valid.
  Returns a boolean.
*/
function _check_mode(mode) {
  // Is it a string?
  if(typeof mode === 'string') {
    // Make it lowercase
    mode = mode.toLowerCase();

    // and check if it's a valid mode
    if (!(mode === 'append' || mode === 'prepend' || mode === 'all')) {
      return new Error(mode+" - Not a valid mode.");
    }
  } else {
    return new TypeError("\"mode\" needs to be from type \"string\""+
      " but it's from type \""+(typeof mode)+"\".");
  }

  // There is no error
  return null;
}


/*
  Check if the given port is valid and is not used. Returns a callback function.
  Second argument of callback is true if the port is used
*/
function _check_port(port) {
  var net = require('net')
  var tester = net.createServer()
  .once('error', function (err) {
    if (err.code != 'EADDRINUSE') 
      return new Error("An error occured: "+err);
    else 
      return new Error("Port "+port+" is in use");
  })
  .once('listening', function() {
    tester.close();
    return null;
  })
  .listen(port)
}

/*
  Create file write options
*/
function _write_options(start) {
  var options = { };

  // Only for append or prepend
  if (start !== undefined) {
    options.start = start;
    options.flags = 'a';
  } 

  return options;
}

/*
  Process copy
  Copies a data and processes it, if a process function is given.
*/
function _process_copy(path, start, end, process, callback) {
  // Define Variables
  // Create the read/write options
  var options = _write_options(start),
    write;

  // Set the encoding
  options.encoding = 'utf8';

  function finish(errorData, processedData) {
    // Data is the data while arrFn the array function for appending/prepending is
    var data = _watchers[path].data || [],
      arrFn;

    // Check for the mode
    if((start !== undefined) && (end !== undefined)) {
      // Prepend mode
      arrFn = 'unshift';
    } else if(start !== undefined) {
      // Append mode
      arrFn = 'push';
    } else {
      // All mode
      data = [];
      arrFn = 'push';
    }

    // Append/Prepend the new data
    for(var i=0; i<processedData.length; ++i) {
      data[arrFn](processedData[i]);
    } // Save the datas
    _watchers[path].data = data;

    // Init the write stream
    write = fs.createWriteStream(path+_extension, options);

    // Write the data and close the stream
    write.end(JSON.stringify(data));

    // Make the callback
    if(callback) callback(errorData, processedData);
  }

  _process_read(start, end, process, finish);
}

function _process_read(start, end, process, callback) {
  // Define variables
  var processedData = [],
    errorData     = [],
    encoding = 'utf8',
    read;

  // Create the readstream
  read = fs.createReadStream(path, readOptions);

  read.on('error', function(err) {
    throw new Error("An error occured while reading the file '"+path+"'.\nDetails: "+err);
  });


  // We don't want to create functions in loops
  function pushData(err, data) {
    if(err)  { // null == undefined => true; this is used here
      errorData.push({
        file: path,
        lineNumber: linecount,
        error: err
      });
    } else {
      processedData.push(data);
    }
  }

  // Reading the stream
  var tmpBuffer = "", linecount = 0;
  read.on('readable', function() {
    var data = '',
      chunk;

    // Read the data in the buffer
    while(null !== (chunk = read.read())) {
      data += chunk;
    }

    // There is no data? Well, wtf but we can't work with no data
    if(data === '') return;

    // Split the data
    var tokens = data.split(newline);
    // No multiple lines? Then we just read a partial line, add it to the buffer and return.
    if(tokens.length === 1) {
      tmpBuffer += tokens[0];
      return;
    }

    // It is possible, that the last "line" of the data isn't complete. So we have to store it and wait for the next readable event
    // Complete the first tokens element with the stored data ...
    tokens[0] = tmpBuffer + tokens[0];
    // ... and saves the last element for the next time
    tmpBuffer = tokens.pop();

    // Process every line on their own
    for(var i=0; i<tokens.length; ++i) {
      // Skip empty lines
      if(tokens[i].length > 0) process(tokens[i], pushData);
      // Increase the linecount
      ++linecount;
    }
  });

  // End the stream
  read.on('end', function(chunk) {
    // We still need to add the last stored line in tmpBuffer, if there is one
    if(tmpBuffer !== "") {
      process(tmpBuffer, pushData);
    }

    // Are there any errors?
    if(errorData.length === 0) errorData = null;

    if(callback) callback(errorData, processedData);
  });
}

/*
  Handle the watch options
*/
function _create_watch_options(mode, options) {
  var nOptions =  {
    mode: mode,
    firstCopy: ((options.firstCopy !== undefined) ? options.firstCopy : _default.firstCopy),
    watch_error: options.watch_error || _default.watch_error,
    work_function: _default.work_function,
    process: options.process || _default.process,
    content: options.content
  };

  // Helpfunction
  function isFunction(fn) {
    return (typeof fn === 'function');
  }

  // Check if process/content are valid
  if(options.process && !isFunction(options.process)) {
    return new TypeError('The process-option needs to be an function.');
  } 
  if(options.content && !isFunction(options.content)) {
    return new TypeError('The content-function needs to be an function.');
  }

  // copy option; a boolean
  if(options.copy === false) {
    // It was already checked if content is a valid function
    if(options.content) {
      // Just process the file and give the data to the specified callback
      nOptions.work_function = _process_read;
    } else {
      /*  There is no point in doing nothing on a change.  This probably
      wasn't the users intention and failing quitly would just confuse. */
      return new Error("Configuration error.\n"+
        "The options specify that copywatch should do nothing on a change,"+
        " then there is no point in watching the file. "+
        "This can't be your intention.");
    }
  } else if(options.process || options.content) {
    nOptions.work_function = _process_copy;
  }

  return nOptions;
}

/*
  Handles a valid change event.
*/
function _handle_change(event, path, currStat, prevStat, options) {
  // Test/create event - process the changes
  if (event === 'update' || event === 'create') {
    if (options.mode === 'append') {
      options.work_function(path, prevStat.size, options.process, options.content);
    } else if (options.mode === 'prepend') {
      options.work_function(path, 0, options.process, options.content);
    } else if (options.mode === 'all') {
      options.work_function(path, undefined, options.process, options.content);
    }
  }
  //  Delete event - delete the copied version
  else if (event === 'delete') {
    // We don't need to delete the copied file if there is no copied file
    fs.exists(path+_extension, function(exists) {
      if(exists) fs.unlink(path+_extension, options.watch_error);
    });
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
        // Arguments isn't a real array
        console.log("Log:", Array.prototype.slice.call(arguments));
      }
    },
    // The error_handler, it is specified in the options object
    error: options.watch_error,
    change: function (event, path, currStat, prevStat) {
      // If its an event for a file we don't watch, there is no reason to process it; this should actually never happen it's just an extra ensurance
      if(_watchers[path] === undefined) return;

      _handle_change(event, path, currStat, prevStat, options);
    }
  };
}

// PUBLIC

/*
  Unwatch a file
    path - path to the file
    remove - bool value: delete the copy version, or leave it?
*/
function unwatch(path, remove, callback) {
  // Make the path an absolute path
  path = path_util.resolve(path);
  if (_watchers[path] !== undefined) {
    _watchers[path].close();
    _watcherCount--;

    delete _watchers[path];

    if (remove) return fs.unlink(path+_extension, (callback || _error_handler));
    else if (callback) return callback();
  } else {
    return callback(new Error("No such file is watched."));
  }
}

/*
  Unwatch for every watcher, when all _watchers are closed the callback is called with a array of potential errors
    remove - bool value: delete the copy versions, or leave them?
    callback - callback function, gets an array of potential errors
*/
function clear(remove, callback) {
  var errors = [], path, handler;

  // We don't want to define functions in loops
  handler = function (err) {
    if (err) errors.push(err);

    /*  When all _watchers are destroyed, call the callback.
      If there is no callback, call the default handler.
      If there are no errors and no callback, do nothing. */
    if (_watcherCount === 0) {
      return (callback || _error_handler)(errors.length>0 ? errors : undefined);
    }
  };

  // Was there a single call? ...
  var called = false;
  for (path in _watchers) {
    if(_watchers.hasOwnProperty(path)) {
      called = true;
      unwatch(path, remove, handler);
    }
  }

  // ... if not, make at least the callback
  if(!called && callback) callback();
}

/*  Set the _extension for the copied files */
function setExtension(newExtension) {
  var path;

  // Rename the old files
  for (path in _watchers) {
    if(_watchers.hasOwnProperty(path)) {
      fs.renameSync(path+_extension, path+newExtension);
    }
  }

  _extension = newExtension;
}
/*  Get the current _extension */
function getExtension() {
  return _extension;
}

/*
  Watch
  'mode' - mode influences the copy/parse mechanism which is used, when the file was updated:
    'append' - copy the last bytes of the file (the difference between prevStat.size and currStat.size)
    'prepend' - copy the first few bytes of the file (the difference between prevStat.size and currStat.size)
    'all' - copy the whole file
  'file' - the file which should be watched
  {options}
    copy - a boolean which states if copywatch should make a copy
      true - the default, copywatch makes a copy
      false - the file won't be copied.
        You will have to give copywatch a content-function (a process-function is optional);
        the content-function will recieve the file-data on change, so you can work with it.
        If there is not content-function than copywatch will throw an error, since there is
        no point in watching a file and doing nothing on change.
    firstCopy - a boolean which states if a first copy of the file should be made, before the watching starts
    watch_error - a function that gets called, when an error occured during watching
    process - a function which processes each line which is read from the file when a change occures.
      The processed data will be saved as JSON in an array with every line, so it's easier to reread it from the file.
      It need to take the following argument: 'string' (the current line), 'callback' (optional - a function
      that recieves the processed line. Otherwise it will be assumed, that the function returns the data.)
    content - a function that recieves the whole content of the file, either parsed (if a process function was given) or in raw form,
      every time a change happens.
      Arguments are err (an potential array of errors) and data (an array of the (processed) lines).
  next - a callback function, that recieves an error, if one occured
*/
function watch(mode, port, options, next) {
  // Define variables
  var i, listenersObj, nextObj,
  // Other stuff
    maybeError, baseName, destFile, fileDir;

  // Check if the given mode is a valid one; if not throw an error
  maybeError = _check_mode(mode);
  if(maybeError) return next(maybeError);

  // Check if port not in use
  maybeError = _check_port(port);
  if(maybeError) return next(maybeError);

  if(typeof options === 'function') {
    next = options;
    options = {};
  }
  // Process the options; use default values if necessary
  options = _create_watch_options(mode, options || {});

  // Did we recieve an error? If yes, then call the next function with this error
  if(options instanceof Error) {
    return next(options);
  }

  // Create listeners
  listenersObj = _create_listeners(options);

  // The object with the function that will be executed after the watcher was correctly configured
  nextObj = function (err, watcherInstance) {
    ++_watcherCount;

    // Execute the next function
    if (next) return next(err);
  };

  // HACK!
  /*  Since we don't want the watchr to stop watching when the file is deleted,
    we watch the whole directory while ignoring all the files we don't want to watch.
    It's a bit ugly but won't mean performance descrease while running, since watchr
    still just watches just the one file. If it's a big directory the startup speed
    can  suffer a bit, but it shoudln't be too bad. */

  // Gets the basename of the file ("/c/node/script.js" would result in "script.js")
  baseName = path_util.basename(file);
  // Creates an absolute path ("../../node/script.js" could result in "/c/node/script.js")
  resFile = path_util.resolve(file);
  // The directory of the file ("/c/node/script.js" would result in "/c/node")
  fileDir = path_util.dirname(resFile);

  // Check for existance and make a first copy/parse; if firstCopy == true
  fs.exists(resFile, function(exists) {
    if(exists === false) {
      console.warn('"'+resFile+'"', "was not found.\n"+
        "copywatch now listens for the \"create\"-event and will watch as specified afterwards.");
    } else if(options.firstCopy) {
      // Make a first copy/parse
      options.work_function(resFile, undefined, undefined, options.process, options.content);
    }
  });

  // Finally watch the file
  _watchers[resFile] = watchr.watch({
    path: fileDir, // We need to watch the directory in order to not stop watching on delete
    ignoreCustomPatterns: new RegExp('^(?!.*'+baseName+'$)'), // The RegExp which ensures that just our file is watched and nothing else
    listeners: listenersObj,
    next: nextObj
  });
}


// Exported functions
module.exports = {
  // Private variables
  _watcher: _watchers,
  _default: _default,
  // Private functions
  _error_handler: _error_handler,
  _check_mode: _check_mode,
  _check_file: _check_file,
  _file_options: _file_options,
  _copy: _copy,
  _process_copy: _process_copy,
  _process_read: _process_read,
  _create_watch_options: _create_watch_options,
  _handle_change: _handle_change,
  _create_listeners: _create_listeners,
  // Public
  watch        : watch,
  // parsewatch   : parsewatch,
  unwatch      : unwatch,
  clear        : clear,
  setExtension : setExtension,
  getExtension : getExtension
};

// 'use static'-end
})();