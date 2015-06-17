(function() {
'use strict';

//Require
var udpsocket   = require('dgram').createSocket('udp4'),
    fs          = require('fs'),

//"Global" variables
    _default    = {
      process: function(string, callback) {
        callback(null, string);
      },
      work_function: _process_msg,
      watch_error: _error_handler
    },
    _extension  = "log", // Log-File Extension
    newline     = /\r\n|\n\r|\n/, // Every possible newline character
    errorFile   = './copywatch.err';

//Functions


//PRIVATE

/*
  Default error_handler
*/
function _error_handler(err) {
  if (err) {
    if ($.isArray(err) && err.length === 0) {
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
  Check if the given port is valid and is not used. Returns an error or null.
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
function _write_options(mode) {
  var options = {};

  // Set the encoding
  options.encoding = 'utf8';

  if (mode=='all') {
    options.flags = 'w'; // overwrite
  } else {
    options.flags = 'a'; // append
    if (mode='prepend') {
      options.start = 0;
    }
  }

  return options;
}

/* Simply writes the message to the file. */
function _log(message, peer, options) {
  var write_options = _write_options(options.mode),
      file = peer.replace(':','.')+'.'+_extension;

  fs.createWriteStream(file, write_options).write(message+'\n');

}

/* Runs a process_msg function with upgraded callback,
 * that additionally writes the message to the log-file.
 * */
function _process_log(message, peer, options, callback) {
  function finish(errorData, processedData) {
    _log(message, peer, options)

    // Make the callback
    if(callback) callback(errorData, processedData);
  }

  _process_msg(message, peer, options, finish);
}

/* Processes the message and uses the callback with processed data. */
function _process_msg(message, peer, options, callback) {
if(callback === undefined) return; //this function is useless without a callback

  // Define variables
  var processedData = [],
      errorData = [],
      tmpBuffer = "",
      linecount = 0,
      data = '';


  //We don't want to create functions in loops
  function pushData(err, data) {
    if(err)  { // null == undefined => true; this is used here
      errorData.push({
        peer: peer,
        lineNumber: linecount,
        error: err
      });
    } else {
      processedData.push(data);
    }
  }

  if(message) {
    data+=message;
  }

  var tokens = data.split(newline);
  // No multiple lines?
  // Then we just read a partial line, add it to the buffer and return.
  if(tokens.length === 1) {
    tmpBuffer += tokens[0];
  } else {

    // It is possible, that the last "line" of the data isn't complete.
    // So we have to store it and wait for the next readable event
    // Complete the first tokens element with the stored data ...
    tokens[0] = tmpBuffer + tokens[0];
    // ... and saves the last element for the next time
    tmpBuffer = tokens.pop();

    // Process every line on their own
    for(var i=0; i<tokens.length; ++i) {
      // Skip empty lines
      if(tokens[i].length > 0) options.process(tokens[i], pushData);
      // Increase the linecount
      ++linecount;
    }
  }

  // We still need to add the last stored line in tmpBuffer, if there is one
  if(tmpBuffer !== "") {
    options.process(tmpBuffer, pushData);
  }

  // Are there any errors?
  if(errorData.length === 0) errorData = null;

  callback(errorData, processedData);
}

/* Handle the watch options */
function _create_watch_options(options) {
  var nOptions =  {
    mode: options.mode,
    watch_error: options.watch_error || _default.watch_error,
    work_function: _default.work_function,
    process: options.process || _default.process,
    port: options.port,
    content: options.content
  };

  // Helpfunction
  function isFunction(fn) {
    return (typeof fn === 'function');
  }

  // Check if process/content are valid
  if(options.process && !isFunction(options.process)) {
    return new TypeError('The process-option needs to be an function.');
  } if(options.content && !isFunction(options.content)) {
    return new TypeError('The content-function needs to be an function.');
  }

  // copy option; a boolean
  if(options.log) {
    // It was already checked if content is a valid function
    if(options.process || options.content) {
      // Process data if needed, log it and use the specified callback with it
      nOptions.work_function =  _process_log;
    } else {
      // Just log the data
      nOptions.work_function =  _log;
    }
  } else if(options.content) {
    // Process data if needed and use the specified callback with the data
    nOptions.work_function = _process_msg;
  } else {
    // There is no point in doing nothing on a message.
    // This probably wasn't the users intention
    // and failing quietly would just confuse.
    return new Error("Configuration error.\n"+
      "The options specify that connect should do nothing on "+
      "a received message, then there is no point in watching the port. "+
      "This can't be your intention.");
  }

  return nOptions;
}

//PUBLIC

/* Closes the port listening */
function unwatch() {
  //Just renew the socket without starting it
  udpsocket = require('dgram').createSocket('udp4');
  console.log('server is closed');
}

/*
  Watch
    port - the port to be watched
    {options}
       ATTENSION: If there is not content-function and log is false than connect
         will throw an error, since there is no point in watching a file and
         doing nothing on change.
      content - a function that becomes a message data, either parsed (if a
        process function was given) or in raw form, every time a change happens.
      process - a function which processes each line from a received message.
        It need to take the following argument: 'string' (the current line),
        'callback' (optional - a function that receives the processed line.
        Otherwise it will be assumed, that the function returns the data.)
        Arguments are err (an potential array of errors) and data
        (an array of the (processed) lines).
      log - a boolean which states if connect should log the messages to the file
        true - the default, connect writes a log
        false - the messages won't be logged.
      mode - mode says how to write the received messages to the file:
        'append' - write messages to the end of the file
        'prepend' - write messages to the start of the file
        'all' - overwrite the whole file with every new message
      watch_error - a function that gets called,
        when an error occurred during watching
*/
function watch(port, options) {
  var maybeError, _lastPeer;

  // Check if it's a valid port
  maybeError = _check_port(port);
  if(maybeError) return next(maybeError);

  // Check if the given mode is a valid one; if not throw an error
  maybeError = _check_mode(options.mode);
  if(maybeError) return next(maybeError);

  // Process the options; use default values if necessary
  options = _create_watch_options(options || {});

  // Did we receive an error? If yes, then return this.
  if(options instanceof Error) return options;

  //Write a message to console if the socket is connected
  udpsocket.on('listening', function() {
    console.log('server listening on port ' + udpsocket.address().port );
  });

  // Message receiver, sends the message to the working Function
  udpsocket.on('message', function(message, info) {

    if(message === '') return;

    _lastPeer = info.address + ':' + info.port;

    console.log('server got message from ' + _lastPeer);

    options.work_function(message, _lastPeer, options, options.content);
  });

  udpsocket.bind(port);
}

// Exported functions
module.exports = {
  // Public
  watch        : watch,
  unwatch      : unwatch
};

})();
