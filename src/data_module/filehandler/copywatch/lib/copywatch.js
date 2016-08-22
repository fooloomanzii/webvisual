(function() {
  'use strict';

  // Require
  var fs = require('fs'),
    path_util = require('path'),
    chokidar = require('chokidar'),
    _ = require('underscore'),

    // "Global" variables
    _default = {
      firstCopy: true,
      process: function(string, callback) {
        callback(null, string);
      },
      work_function: _copy,
      watch_error: _error_handler,
      interval: 400,
      catchupDelay: 400 // according Nyquist-Theorem
    },
    _watchers = {},
    _watcher_options = {},
    _wait_to_restore = [], // Files/directories currently waiting for restoration
    _watcherCount = 0,
    _extension = '.log',
    newline = /\r\n|\n\r|\n/, // Every possible newline character
    errorFile = './copywatch.err';

  // Functions

  // PRIVATE

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
      return_error = new Error("Expected path to an file but got something else. Copywatch just watches files.");
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
    Copy
    Copies a file. Simple and plain.
  */
  function _copy(path, start, end, process, content, copy_path) {
    var options = _file_options(start, end);
    // Copies the file
    fs.createReadStream(copy_path, options.readOptions).pipe(fs.createWriteStream(copy_path + _extension, options.writeOptions));
  }

  /*
    Process copy
    Copies a file and processes it, if a process function is given.
  */
  function _process_copy(path, start, end, process, callback, copy_path) {
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
      write = fs.createWriteStream(copy_path + _extension, options);

      // Write the data and close the stream
      write.end(JSON.stringify(data));

      // Make the callback
      if (callback) callback(errorData, processedData);
    }

    _process_read(path, start, end, process, finish);
  }

  // Read Process
  function _process_read(path, start, end, process, callback) {
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
      console.warn("An error occured while reading the file '" + path + "'.\nDetails: " + err.details);
    });


    // We don't want to create functions in loops
    function pushData(err, data) {
      if (err) { // null == undefined => true; this is used here
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
    var tmpBuffer = "",
      linecount = 0;

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
        if (tokens[i].length > 0) process(tokens[i], pushData);
        // Increase the linecount
        ++linecount;
      }
    });

    // End the stream
    read.on('end', function(chunk) {
      // We still need to add the last stored line in tmpBuffer, if there is one
      if (tmpBuffer !== "") {
        process(tmpBuffer, pushData);
      }
      // Are there any errors?
      if (errorData.length === 0) errorData = null;

      if (callback) callback(errorData, processedData);
    });
  }

  // Read a json file
  function _process_read_json_file(path, start, end, process, callback) {
    // (starts same as _process_read)
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
      console.warn("An error occured while reading the file '" + path + "'.\nDetails: " + err.details);
    });

    // Reading the stream
    var tmpBuffer = "";

    read.on('readable', function() {
      var chunk;

      // Read the data in the buffer
      while (null !== (chunk = read.read())) {
        tmpBuffer += chunk;
      }

      // There is no data? Well, wtf but we can't work with no data
      if (tmpBuffer === '') return;
    });

    // End the stream
    read.on('end', function(chunk) {
      // We still need to add the last stored line in tmpBuffer, if there is one
      if (chunk) tmpBuffer += chunk;

      // Try to parse the data-String in JSON
      try {
        processedData = process(tmpBuffer);
      } catch (err) {
        console.warn("Invalid Format in file '" + path + "'.\n" + err);
        errorData.push({
          file: path,
          error: err
        });
      }
      // Are there any errors?
      if (errorData.length === 0) errorData = null;

      if (callback) callback(errorData, processedData);
    });
  }

  /*
    Handle the watch options
  */
  function _create_watch_options(mode, options) {
    var nOptions = {
      mode: mode,
      firstCopy: ((options.firstCopy !== undefined) ? options.firstCopy : _default.firstCopy),
      watch_error: options.content || _default.watch_error,
      work_function: _default.work_function,
      process: options.process || _default.process,
      content: options.content,
      copy_path: path_util.join(options.copy_path, options.path),
      interval: options.interval || _default.interval,
      catchupDelay: options.catchupDelay || _default.catchupDelay
    };

    // Helpfunction
    function isFunction(fn) {
      return (typeof fn === 'function');
    }

    // Check if process/content are valid
    if (options.process && !isFunction(options.process)) {
      return new TypeError('The process-option needs to be an function.');
    }
    if (options.content && !isFunction(options.content)) {
      return new TypeError('The content-function needs to be an function.');
    }

    // copy option; a boolean
    if (options.copy === false) {
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
          "The options specify that copywatch should do nothing on a change," +
          " then there is no point in watching the file. " +
          "This can't be your intention.");
      }
    } else if (options.process || options.content) {
      nOptions.work_function = _process_copy;
    }

    return nOptions;
  }

  /*
    Handles a valid change event.
  */
  function _handle_change(event, path, currStat, prevStat, options) {
    // Test/create event - process the changes
    // console.log(event);
    if (event === 'change' || event === 'ready') || event === 'add') {
      if (event === 'add')
        console.log('"' + path_util.basename(path) + '" was created.');
      if (options.mode === 'append') {
        options.work_function(path, prevStat.size, undefined, options.process, options.content, options.copy_path);
      } else if (options.mode === 'prepend') {
        options.work_function(path, 0, (currStat.size - prevStat.size), options.process, options.content, options.copy_path);
      } else if (options.mode === 'all' || options.mode === 'json') {
        options.work_function(path, undefined, undefined, options.process, options.content, options.copy_path);
      }
    }
    //  Delete event
    else if (event === 'unlink' || event === 'unlinkDir' || event === 'error') {
      var fileDir = path_util.dirname(path);
      var starttime = new Date();

      //Check for existence of directory
      fs.exists(fileDir, function(exists) {
        if (exists === false) { // If directory doesn't exists -> need to wait until it's restored
          // Check if already waiting
          if (_wait_to_restore.indexOf(fileDir) >= 0) return;
          _wait_to_restore.push(fileDir);

          console.warn('Directory "' + fileDir + '" was deleted.\n' +
            'After restoring the directory, the file will be watched as earlier.');
          //wait until directory is restored
          var wait_until_restored = function() {
            fs.exists(fileDir, function(exists) {
              if (exists === false) {
                // check for directory every 500 ms.
                setTimeout(wait_until_restored, 500);
              } else {
                // directory was restored -> continue watching
                if (_watcher_options[path] !== undefined)
                  _watchers[path] = new chokidar.watch(path, _watcher_options[path]);
                // Remove directory from _wait_to_restore list
                _wait_to_restore.splice(_wait_to_restore.indexOf(fileDir), 1);
                console.log('Directory "' + fileDir + '" was restored after ' +
                  (new Date() - starttime) + ' milliseconds.');
              }
            });
          }
          wait_until_restored();
        } else {
          if (new Date() - starttime > 500) {
            //if directory is remote one, may be connection was broken and quickly restored.
            //but deletion has caused chokidar to stop, so we start the chokidar again.
            _watchers[path] = new chokidar.watch(path, _watcher_options[path]);
            console.warn('Connection to "' + path +
              '" was broken and quickly restored, so it\'s not a problem.');
          } else {
            console.warn('"' + path + '" was deleted.\n' +
              "copywatch now listens for the \"create\"-event and will watch as specified afterwards.");
          }
          // We don't need to delete the copied file if there is no copied file
          fs.exists(path_util.join(options.copy_path, _extension), function(exists) {
            if (exists) fs.unlink(path_util.join(options.copy_path, _extension), options.watch_error);
          });
        }
      });
    }
  }

  /*
    Create the listeners object
  */
  function _create_listeners(options) {
    return {
      // The log listener; logs all given arguments except the logLevel on stdout
      log: function(logLevel) {
        if (logLevel === 'dev') {
          // Arguments isn't a real array
          console.log("Log:", Array.prototype.slice.call(arguments));
        }
      },
      // The error_handler, it is specified in the options object
      error: options.watch_error,
      watching: function(err, watcherInstance, isWatching) {
        if (err) {
          // directory deletion errors are handled
          // UNKNOWN can be thrown by file-side ECONNRESET (disconnection)
          // ECONNRESET is thrown by server-side disconnection
          // ENOENT and EPERM are thrown by renamed/removed/moved directory
          // All these errors can cause 'delete' event but not every time (lies on chokidar)
          // Lets call 'delete' event, so it will try to reconnect to missing file/directory
          if (err.code === 'UNKNOWN' || err.code === 'ECONNRESET' || err.code === 'ENOENT' || err.code === 'EPERM') {
            if (watcherInstance.children) {
              for (var file in watcherInstance.children)
                _handle_change('unlink', watcherInstance.children[file].path, null, null, options);
            }
            return;
          }
          // If it's some unknown error, trigger the error callback.
          console.log("Watching the path " + watcherInstance.path + " failed with error");
          options.content(err);
        } else {
          if (!isWatching) {
            console.log("Finished Watching " + watcherInstance.path);
          } else {
            if (watcherInstance.children) {
              for (var file in watcherInstance.children)
                console.log("Started watching " + watcherInstance.children[file].path);
            } else {
              console.log("Started watching " + watcherInstance.path);
            }
          }
        }
      },
      change: function(event, path, currStat, prevStat) {
        // If its an event for a file we don't watch, there is no reason to process it; this should actually never happen it's just an extra ensurance
        if (_watchers[path] === undefined) return;

        _handle_change(event, path, currStat, prevStat, options);
      }
    };
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
      console.log("Stoped watching file '" + path + "'.");
      _watchers[path].close();
      _watcherCount--;

      delete _watchers[path];
      delete _watcher_options[path];

      if (remove) {
        return fs.unlink(path, (callback || _error_handler));
      } else if (callback) return callback();
    } else {
      if (callback)
        return callback(new Error("No such file is watched."));
    }
  }

  /*
    Unwatch for every watcher, when all _watchers are closed the callback is called with a array of potential errors
      remove - bool value: delete the copy versions, or leave them?
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
        fs.renameSync(copy_path + _extension, copy_path + newExtension);
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
  function watch(mode, file, options, callback) {
    // Define variables
    let listenersObj, nextObj,
      // Other stuff
      maybeError, baseName, resFile, fileDir;

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

    // Create listeners
    listenersObj = _create_listeners(options);

    // The object with the function that will be executed after the watcher was correctly configured
    nextObj = function(err, watcherInstance) {
      ++_watcherCount;
      // Execute the next function
      if (callback) return callback(err);
    };

    // HACK!
    /*  Since we don't want the chokidar to stop watching when the file is deleted,
      we watch the whole directory while ignoring all the files we don't want to watch.
      It's a bit ugly but won't mean performance descrease while running, since chokidar
      still just watches just the one file. If it's a big directory the startup speed
      can  suffer a bit, but it shoudln't be too bad. */


    // TODO(fooloomanzii):
    // This "Hack" causes that there can only be watched one file per directory
    // rewrite this

    resFile = path_util.resolve(file);
    fileDir = path_util.dirname(resFile);

    // function to start the file watching
    var watch_the_file = function() {
      // Check for existence and make a first copy/parse; if firstCopy == true
      fs.exists(resFile, function(exists) {
        if (exists === false) {
          console.warn('"' + resFile + '"', "was not found.\n" +
            "copywatch now listens for the \"create\"-event and will watch as specified afterwards.");
        } else if (options.firstCopy) {
          // Make a first copy/parse
          options.work_function(resFile, undefined, undefined, options.process, options.content);
        }
      });

      // Finally watch the file
      _watcher_options[resFile] = {
        listeners: listenersObj,
        next: nextObj,
        interval: options.interval,
        catchupDelay: options.catchupDelay
      };
      _watchers[resFile] = new chokidar.watch(resFile, _watcher_options[resFile]);
      callback();
    }

    //Check for existence of directory
    fs.exists(fileDir, function(exists) {
      if (exists === false) { // If directory doesn't exists -> no reason to start the watcher
        console.warn('Directory "' + fileDir + '" was not found. Waiting on creation...');
        var wait_until_created = function() {
          fs.exists(fileDir, function(exists) {
            if (exists === false) {
              // check for directory every 100 ms.
              setTimeout(wait_until_created, 100);
            } else {
              // directory was created -> start watching
              watch_the_file();
              console.log('Directory "' + fileDir + '" was created.');
            }
          });
        }
        wait_until_created();
      } else {
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
    _copy: _copy,
    _process_copy: _process_copy,
    _process_read: _process_read,
    _create_watch_options: _create_watch_options,
    _handle_change: _handle_change,
    _create_listeners: _create_listeners,
    // Public
    watch: watch,
    // parsewatch   : parsewatch,
    unwatch: unwatch,
    clear: clear,
    setExtension: setExtension,
    getExtension: getExtension
  };

  // 'use static'-end
})();
