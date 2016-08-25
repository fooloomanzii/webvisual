/*
  FileWatch (modification of copywatch on base of chokidar)
  *********************************************************
  'mode' - mode influences the log/parse mechanism which is used, when the file was updated:
    'append' - log the last bytes of the file (the difference between prevStat.size and currStat.size)
    'prepend' - log the first few bytes of the file (the difference between prevStat.size and currStat.size)
    'all' - log the whole file
  'file' - the file which should be watched
  {options}
    log - a boolean which states if filewatch should make a log
      true - the default, filewatch makes a log
      false - the file won't be copied.
        You will have to give filewatch a content-function (a process-function is optional);
        the content-function will recieve the file-data on change, so you can work with it.
        If there is not content-function than filewatch will throw an error, since there is
        no point in watching a file and doing nothing on change.
    firstLog - a boolean which states if a first log of the file should be made, before the watching starts
    watch_error - a function that gets called, when an error occured during watching
    process - a function which processes each line which is read from the file when a change occures.
      The processed data will be saved as JSON in an array with every line, so it's easier to reread it from the file.
      It need to take the following argument: 'string' (the current line), 'callback' (optional - a function
      that recieves the processed line. Otherwise it will be assumed, that the function returns the data.)
    content - a function that recieves the whole content of the file, either parsed (if a process function was given) or in raw form,
      every time a change happens.
      Arguments are err (an potential array of errors) and data (an array of the (processed) lines).
*/

(function() {
  'use strict';

  // Require
  var fs = require('fs'),
    path_util = require('path'),
    chokidar = require('chokidar'),
    _ = require('underscore'),

    // "Global" variables
    _default = {
      firstLog: false,
      processor: {
        parse: function(string, callback) {
          callback(null, string);
        }
      },
      work_function: _log,
      watch_error: _error_handler,
      watch_settings: {
        persistent: true,
        ignoreInitial: false,
        followSymlinks: true,
        useFsEvents: true,
        usePolling: false,
        interval: 100,
        binaryInterval: 100,
        alwaysStat: true,
        ignorePermissionErrors: false,
        atomic: false,
        awaitWriteFinish: false
      }
    },
    _watchers = {},
    _watcherCount = 0,
    _extension = '.log',
    newline = /\r\n|\n\r|\n/, // Every possible newline character
    errorFile = './filewatch.err';

  // Functions

  /*
    Default error_handler
  */
  function _error_handler(err) {
    if (err) {
      if (_.isArray(err) && err.length === 0) {
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
    if (typeof mode === 'string') {
      // Make it lowercase
      mode = mode.toLowerCase();

      // and check if it's a valid mode
      if (!(mode === 'append' || mode === 'prepend' || mode === 'all' || mode === 'json')) {
        return new Error(mode + " - Not a valid mode.");
      }
    } else {
      return new TypeError("\"mode\" needs to be from type \"string\"" +
        " but it's from type \"" + (typeof mode) + "\".");
    }

    // There is no error
    return null;
  }

  /*
    Check if it's a valid file and not something else. Returns an error or null.
  */
  function _check_file(path) {
    var return_error = null;

    // Check if it exists and check if the file is actually a file; return an error if it isn't
    if (fs.existsSync(path) && !fs.statSync(path).isFile()) {
      return_error = new Error("Expected path to an file but got something else. Logwatch just watches files.");
    }

    return return_error;
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
    if (start !== undefined) {
      // Read
      options.readOptions.start = start;
      // Write
      options.writeOptions.start = start;
      options.writeOptions.flags = 'a';
    }
    if (end !== undefined) {
      // Read; the -1 are necessary because the file starts at 0 and otherwise it would read 1 byte too mutch
      options.readOptions.end = end - 1;
    }

    return options;
  }

  /*
    Log
    Copies a file. Simple and plain.
  */
  function _log(path, start, end, processor, content, log_path) {
    var options = _file_options(start, end);
    // Copies the file
    fs.createReadStream(log_path, options.readOptions).pipe(fs.createWriteStream(log_path + _extension, options.writeOptions));
  }

  /*
    Process log
    Copies a file and processes it, if a process function is given.
  */
  function _process_log(path, start, end, processor, callback, log_path) {
    // Define Variables
    // Create the read/write options
    var options = _file_options(start, end).writeOptions,
      write;

    // Set the encoding
    options.encoding = 'utf8';

    function finish(errorData, processedData) {
      // Data is the data while arrFn the array function for appending/prepending is
      var data = _watchers[path].data || [],
        arrFn;

      // Check for the mode
      if ((start !== undefined) && (end !== undefined)) {
        // Prepend mode
        arrFn = 'unshift';
      } else if (start !== undefined) {
        // Append mode
        arrFn = 'push';
      } else {
        // All mode
        data = [];
        arrFn = 'push';
      }

      // Append/Prepend the new data
      for (var i = 0; i < processedData.length; ++i) {
        data[arrFn](processedData[i]);
      } // Save the datas
      _watchers[path].data = data;

      // Init the write stream
      write = fs.createWriteStream(log_path + _extension, options);

      // Write the data and close the stream
      write.end(JSON.stringify(data));

      // Make the callback
      if (callback) callback(errorData, processedData);
    }

    _process_read(path, start, end, processor, finish);
  }

  // Read Process
  function _process_read(path, start, end, processor, callback) {
    // Define variables
    var processedData = [],
      errorData = [],
      readOptions = _file_options(start, end).readOptions,
      read;

    // Set the encoding
    readOptions.encoding = 'utf8';

    // Create the readstream
    read = fs.createReadStream(path, readOptions);

    read.on('error', function(err) {
      errorData.push({
        path: path,
        details: err + ' '
      });
    });


    // We don't want to create functions in loops
    function pushData(err, data) {
      if (err) { // null == undefined => true; this is used here
        errorData.push({
          path: path,
          details: err + ' '
        });
      } else {
        processedData.push(data);
      }
    }

    // Reading the stream
    var tmpBuffer = "";

    read.on('readable', function() {
      var data = '',
        chunk;

      // Read the data in the buffer
      while (null !== (chunk = read.read())) {
        data += chunk;
      }

      // There is no data? Well, wtf but we can't work with no data
      if (data === '') return;

      // Split the data
      var tokens = data.split(newline);
      // No multiple lines? Then we just read a partial line, add it to the buffer and return.
      if (tokens.length === 1) {
        tmpBuffer += tokens[0];
        return;
      }

      // It is possible, that the last "line" of the data isn't complete. So we have to store it and wait for the next readable event
      // Complete the first tokens element with the stored data ...
      tokens[0] = tmpBuffer + tokens[0];
      // ... and saves the last element for the next time
      tmpBuffer = tokens.pop();

      // Process every line on their own
      for (var i = 0; i < tokens.length; ++i) {
        // Skip empty lines
        if (tokens[i].length > 0) processor.parse(tokens[i], pushData);
      }
    });

    // End the stream
    read.on('end', function(chunk) {
      // We still need to add the last stored line in tmpBuffer, if there is one
      if (tmpBuffer !== "") {
        processor.parse(tmpBuffer, pushData);
      }
      // Are there any errors?
      if (errorData.length === 0) errorData = null;

      if (callback) callback(errorData, processedData);
    });
  }

  // Read a json file
  function _process_read_json_file(path, start, end, processor, callback) {
    var processedData = {},
      errorData = [];

    fs.readFile(path, (err, data) => {
      if (err) {
        errorData.push({
          path: path,
          details: err + ' '
        });
      }
      try {
        processedData = JSON.parse(data);
      } catch (err) {
        console.warn("Invalid Format in file '" + path + "'.\n" + err);
        errorData.push({
          path: path,
          details: err + ' '
        });
      } finally {
        if (errorData.length === 0) errorData = null;
        if (callback) callback(errorData, processedData);
      }
    });
  }

  /*
    Handle the watch options
  */
  function _create_watch_options(mode, options) {
    var nOptions = {
      mode: mode,
      firstLog: ((options.firstLog !== undefined) ? options.firstLog : _default.firstLog),
      watch_error: options.content || _default.watch_error,
      work_function: _default.work_function,
      processor: options.processor || _default.processor,
      content: options.content,
      log_path: path_util.join(options.log_path, options.path),
      watch_settings: options.watch_settings || _default.watch_settings
    };

    // Helpfunction
    function isFunction(fn) {
      return (typeof fn === 'function');
    }

    // Check if processor/content are valid
    if (options.processor && options.processor.parse && !isFunction(options.processor.parse)) {
      return new TypeError('The processor.parse needs to be an function.');
    }
    if (options.content && !isFunction(options.content)) {
      return new TypeError('The content-function needs to be an function.');
    }

    if (mode === 'append' || mode === 'prepend')
      nOptions.watch_settings.alwaysStat = true;

    // log option; a boolean
    if (options.log === false) {
      // It was already checked if content is a valid function
      if (options.content) {
        // Just process the file and give the data to the specified callback
        if (nOptions.mode === "json")
        // read option, if you like to watch a json file
          nOptions.work_function = _process_read_json_file;
        else
          nOptions.work_function = _process_read;
      } else {
        /*  There is no point in doing nothing on a change.  This probably
        wasn't the users intention and failing quitly would just confuse. */
        return new Error("Configuration error.\n" +
          "The options specify that filewatch should do nothing on a change," +
          " then there is no point in watching the file. " +
          "This can't be your intention.");
      }
    } else if (options.processor || options.content) {
      nOptions.work_function = _process_log;
    }

    return nOptions;
  }

  /*
    Handles a valid change event.
  */
  function _handle_change(path, currStat, prevStat, options) {
    if (options.mode === 'append') {
      options.work_function(path, prevStat, currStat, options.processor, options.content, options.log_path);
    } else if (options.mode === 'prepend') {
      options.work_function(path, 0, (currStat - prevStat), options.processor, options.content, options.log_path);
    } else if (options.mode === 'all') {
      options.work_function(path, undefined, undefined, options.processor, options.content, options.log_path);
    } else if (options.mode === 'json'){
      options.work_function(path, undefined, undefined, options.processor, options.content, options.log_path);
    }
  }

  // PUBLIC

  /*
    Unwatch a file
      path - path to the file
      remove - bool value: delete the version, or leave it?
  */
  function unwatch(path, remove, callback) {
    // Make the path an absolute path
    path = path_util.resolve(path);
    if (_watchers[path] !== undefined) {
      console.log("Stoped watching file '" + path);
      _watchers[path].close();
      _watcherCount--;

      delete _watchers[path];

      if (remove) {
        return fs.unlink(path, (callback || _error_handler));
      } else if (callback) return callback();
    } else {
      if (callback) {
        return callback(new Error("No such file is watched."));
      }
    }
  }

  /*
    Unwatch for every watcher, when all _watchers are closed the callback is called with a array of potential errors
      remove - bool value: delete the log versions, or leave them?
      callback - callback function, gets an array of potential errors
  */
  function clear(remove, callback) {
    var errors = [],
      path, handler;

    // We don't want to define functions in loops
    handler = function(err) {
      if (err) errors.push(err);

      /*  When all _watchers are destroyed, call the callback.
        If there is no callback, call the default handler.
        If there are no errors and no callback, do nothing. */
      if (_watcherCount === 0) {
        return (callback || _error_handler)(errors.length > 0 ? errors : undefined);
      }
    };

    // Was there a single call? ...
    var called = false;
    for (path in _watchers) {
      if (_watchers.hasOwnProperty(path)) {
        called = true;
        unwatch(path, remove, handler);
      }
    }

    // ... if not, make at least the callback
    if (!called && callback) callback();
  }

  /*  Set the _extension for the copied files */
  function setExtension(newExtension) {
    var path;
    // Rename the old files
    for (path in _watchers) {
      if (_watchers.hasOwnProperty(path)) {
        fs.renameSync(log_path + _extension, log_path + newExtension);
      }
    }
    _extension = newExtension;
  }

  /*  Get the current _extension */
  function getExtension() {
    return _extension;
  }

  function watch(mode, file, options, callback) {
    // Define variables
    let listenersObj, nextObj,
      // Other stuff
      maybeError, resFile;

    // Check if the given mode is a valid one; if not throw an error
    maybeError = _check_mode(mode);
    if (maybeError) throw maybeError;

    // Check if it's a valid file
    maybeError = _check_file(file);
    if (maybeError) throw maybeError;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    // Process the options; use default values if necessary
    options = _create_watch_options(mode, options || {});

    if (callback == undefined) callback = options.watch_error;

    // Did we recieve an error? If yes, then call the next function with this error
    if (options instanceof Error) {
      return callback(options);
    }

    resFile = path_util.resolve(file);

    // function to start the file watching
    var watch_the_file = function() {
      if (options.firstLog) {
        // Make a first log/parse
        console.log(`File ${resFile} is being copied and processed first`);
        options.work_function(resFile, undefined, undefined, options.processor, options.content);
      }

      // Finally watch the file
      _watchers[resFile] = new chokidar.watch(resFile, options.watch_settings);
      _watchers[resFile]
        .on('add', (path, stats) => {
          console.log(`File ${path} is being added to watch`);
          _handle_change(path, stats.size, 0, options);
          _watchers[path].prevStat = stats.size;
        })
        .on('change', (path, stats) => {
          // if (stats)
          //   console.log(`File ${path} changed size from ${_watchers[path].prevStat} to ${stats.size}`);
          _handle_change(path, stats.size, _watchers[path].prevStat, options);
          _watchers[path].prevStat = stats.size;
        })
        .on('unlink', path => console.log(`File ${path} has been removed`))
        .on('error', error => console.log(`Watcher error: ${error}`));
      callback();
    }

    //Check for existence of directory
    fs.exists(resFile, function(exists) {
      if (exists === false) { // If file doesn't exists -> no reason to start the watcher
        console.log(resFile, "was not found.\n\"filewatch\" now listens for creation.");
        var wait_until_created = function() {
          fs.exists(resFile, function(exists) {
            if (exists === false) {
              // check for file every 200ms.
              setTimeout(wait_until_created, 200);
            } else {
              // file was created -> start watching
              watch_the_file();
            }
          });
        }
        wait_until_created();
      } else {
        if (_watchers[resFile] !== undefined) {
          unwatch(resFile);
        }
        watch_the_file();
      }
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
    _log: _log,
    _process_log: _process_log,
    _process_read: _process_read,
    _create_watch_options: _create_watch_options,
    _handle_change: _handle_change,
    // Public
    watch: watch,
    unwatch: unwatch,
    clear: clear,
    setExtension: setExtension,
    getExtension: getExtension
  };
})();
