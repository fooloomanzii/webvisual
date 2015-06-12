/**
 * HOW TO USE
 *
 * The DataHandler class. This class is used to handle data connections and the incoming data with ease.
 * @param  {Object} config A configuration object with the following options:
 *     @attr  {Array/Object} connection
 *         A array or object with a list of connections to use. If an array is used, the module will use default
 *         configuration for the connections. Alternatively you can use the object format to add your own custom
 *         configuration for the connection.
 *         In this case the keys represent the connection type while you can add objects as value for further configuration.
 *         Example:
 *         {
 *           db: {
 *             option1: 1,
 *             option2: 2
 *           },
 *           file: {
 *             option1: 'a',
 *             option2: 'b'
 *           }
 *         }
 *     @attr  {Function/Object} listener
 *         The attributes of this object can be used to add listener on the various events of the DataHandler.
 *         Valid listener are:
 *         data
 *             Will be called when new data arrives, the arguments it receives are:
 *                 type - The connection type as string (db, file etc.)
 *                 data - The data as object or array (for multiple data)
 *         error
 *             Will be called when an error occurs. Receives the following arguments:
 *                 type - The connection type as string (db, file etc.)
 *                 error - The error as object or array (for multiple errors)
 */

// jshint unused:false
'use strict';

var
// Own modules
  udpwatch    = require('../modules/udpwatch'),
  copywatch   = require('../modules/copywatch'),
  data_parser = require('../modules/data_parser'),
  path_util   = require('path'),
// Node modules
  net      = require('net'),
  _        = require('underscore'),
// Mailer variables and log in information
  // mail, icsMail = require('./mail.json'),
// Class
  EventEmitter = require('events').EventEmitter,
  DataHandler,
// Config & Co
  connectionDefaults = {
    "db": {
      // TODO: Default DB configuration
    },
    "file": {
      // We don't need to make a copy of the file
      copy: false,
      // The watching mode ('all', 'append', 'prepend')
      mode: 'all',
      // Default file: Same dir as the "master" script
      path: __dirname+'/../../data/data.txt',
      // The default parse function from the data_parser module
      process: data_parser.parse
    },
    "udp": {
      // We don't need to make a copy of the data
      log: false,
      // The watching mode ('all', 'append', 'prepend')
      mode: 'append',
      // Default port for receiving the data from the source
      port: 4000,
      // The default parse function from the data_parser module
      process: data_parser.parse
    }
  },
  // All connect and close functions for the different connection types; the functions are added at a later point
  connectionFn = {
    db: {
      close:   null,
      connect: null
    },
    file: {
      close:   null,
      connect: null
    },
    tcp: {
      close:   null,
      connect: null
    }
  },
  messages = {
    ConnectionConfigTypeMsg: "Expected simple object as config-value for connection.",
    functions: {
      ConnectionTypeMsgFn: function(connectionType) {
        return "The given connection type \""+connectionType+"\" is invalid. Valid types are: "+_(connectionFn).functions();
      },
      DataErrorMsgFn: function(type, error) {
        return _(error).reduce(function(memo, value) {
          // Use the 'toString'-method, if available, to create a easier to read message
          return memo+'\n'+(typeof value.toString === 'function' ? value.toString() : value);
        }, "Recieved a single or multiple errors from the connection '"+type+"'.");
      },
      TypeErrorMsgFn: function(expectedType, forWhat, recievedType) {
        // Returns a descriptive message dependend on the arguments
        return "Expected \""+expectedType+"\"-type"+
        (forWhat ? " for "+forWhat : "")+
        (recievedType ? ", recieved \""+recievedType+"\"" : "")+".";
      },
      UnknownErrorMsgFn: function() {
        return _(arguments).reduce(function(memo, value) {
          // Use the 'toString'-method, if available, to create a easier to read message
          return memo+'\n'+(typeof value.toString === 'function' ? value.toString() : value);
        }, "Unknown error occured. For more information see additional arguments:");
      }
    }
  },
  // A list of valid events
  validEvents = [
    "error",
    "data"
  ];

// Extend Underscore
_.mixin({
  /**
   * Creates an array from the given thing. Or returns it if it's already an array.
   * @param  thing   Literally anything. Whatever it is, this function creates an array out of it.
   * @return {Array} An array which contains the thing, or the thing itself, if it was already an array.
   */
  makeArray: function(thing) {
    // Test if the thing is already an array
    if(_(thing).isArray()) return thing;
    else if(_(thing).isUndefined()) return [];
    else return [ thing ];
  },
  // Iterates over an object and executes the iterator function on every key
  mapKeys: function(object, iterator) {
    return _.object(
      _(object).map(function(value, key) {
        return [iterator(key), value];
      })
    );
  },
  // Iterates over an object and executes the iterator function on every value
  mapValues: function(object, iterator) {
    return _.object(
      _(object).map(function(value, key) {
        return [key, iterator(value)];
      })
    );
  },
  // Iterates over an object and executes the iterator functions on the keys and values
  mapObject: function(object, keyIterator, valueIterator) {
    return _.object(
      _(object).map(function(value, key) {
        return [keyIterator(key), valueIterator(value)];
      })
    );
  },
  // String manipulation
  toLowerCase: function(string) {
    if(typeof string === 'string') return string.toLowerCase();
  },
  toUpperCase: function(string) {
    if(typeof string === 'string') return string.toUpperCase();
  },
});


/////////////////////////////////
// Static connection functions //
/////////////////////////////////

/**
 * The database connect function. Establishes a connection to a specified database.
 * @param  {Object} config The configuration for the database connection
 * @return {Object}        A database connection object
 */
connectionFn.db = {
  // TODO: Add close function
  close: function() {},
  connect: function(config, emitter) {
    return null;
  }
};


connectionFn.file = {
  /**
   * Ends the watching of the specified file.
   * @param  {Object}   config   Configuration object which contains the necessary information
   *                             to end the connection
   * @param  {Function} callback A callback function which recieves a potential error.
   */
  close: function(config, callback) {
    // Log
    console.log("Stopped watching \""+config.path+"\"");
    // End the watching
    copywatch.unwatch(config.path, config.remove, callback);
  },
  /**
   * The file watch connect function. Enables the watching and processing of a file.
   * @param  {Object} config The configuration for the watching
   * @return {Object}        Contains the necessary data to end the watcher
   */
  connect: function(config, emitter) {
    // Log
    console.log("Started watching \""+path_util.basename(config.path)+"\"");

    // Add the function which recieves the parsed data; calls the emitter
    config.content = emitter;

    // Start watching the file
    copywatch.watch(config.mode, config.path, config);

    // Return the necessary data to end the watcher
    return { path: config.path, remove: config.copy };
  }
};

connectionFn.udp = {
  /**
   * Ends the listening of the specified UDP.
   * @param  {Object}   config   Configuration object which contains the necessary information
   *                             to end the connection
   * @param  {Function} callback A callback function which recieves a potential error.
   */
  close: function() {
    // Close the connection
    udpwatch.unwatch();
  },

  /**
   * The UDP connect function. Establishes a UDP listener to the specified port.
   * @param  {Object} config The configuration for the UDP connection
   * @return {Object} An UDP connection object
   */
  connect: function(config, emitter) {

    // Add the function which recieves the parsed data; calls the emitter
    config.content = emitter;

    // Start watching the port
    udpwatch.watch(config.port, config);

    // Return the necessary data to end the watcher
    return { port: config.port, remove: config.copy };
  }
};


/**
 * The data handler class. This module returns an instance of this class for possible connections.
 * To handle incoming data listeners can be bound to the 'data' event.
 * It is possible to create a instance for multiple connection-types.
 */
DataHandler = (function() {
  // jshint validthis:true
  var defaults = {
      listener: {
        error: function(type, err) {
          //here is the space for reactions on the mistaken data
          throw new Error(messages.functions.DataErrorMsgFn(type, err));
        },
        data: console.log
      }
    };

  // jshint newcap: false
  // Constructor
  function _Class(config) {
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(config);

    // Use defaults for undefined values
    _(config).defaults(defaults);

    // Add a instance of the EventEmitter
    this._emitter = new EventEmitter();

    // Validate and process the connections
    this._connect(config.connection);

    // Process the given listener
    this._addListener(config.listener);
  }

  // Extend with properties; null values are just place holder for instantiated properties
  _(_Class.prototype).extend({
    _emitter    : null,
    _connections: {}
  });

  /////////////////////
  // Private Methods //
  /////////////////////

  /**
   * Adds the given listeners to the data and the error event.
   * @param {Object} listener A object with the listeners to add, valid listeners are 'data' and 'error'.
   *                          The default 'data'-listener just prints the received arguments, while the default
   *                          'error'-listener throws the received error.
   */
  _Class.prototype._addListener = function(listener) {
    var self = this;

    // Check if the listener object is actually a function; in this case the function is assumed to be the 'data'-listener
    if(typeof listener === 'function') {
      listener = { data: listener };
    }
    // Use default values, if necessary
    _(listener).defaults(defaults.listener);

    // Ensure the listener properties are arrays of listeners
    listener = _(listener).mapValues(_.makeArray);

    // Add the listener
    _(listener.data).each(function(listener) { self._emitter.on('data', listener); });
    _(listener.error).each(function(listener) { self._emitter.on('error', listener); });
  };

  /**
   * Creates an emitter function that receives a potential error and the new data.
   * The function emits this error/data as an event with the given type information.
   *
   * @param  {String} type The connection type from whom the data was received
   * @return {Function}    An emitter function that emits received data/error with the specified type information
   */
  _Class.prototype._createEmitter = function(type) {
    var self = this;

    // Return a function that receives an potential error and the data;
    // emits a fitting event with the given type information
    return function(error, data) {
      // TODO: Array or not array?
      if(error) {
        self._emitter.emit('error', type, error);
      } else {
        self._emitter.emit('data', type, data);
      }
    };
  };

  /**
   * THE connect function. Receives a configuration object or a list of connections and establishes the connections.
   * The connections get saved in the "private" _connections object of the DataHandler instance.
   *
   * @param  {Object / Array} connection A object where the keys specify the connection type and the value is the configuration
   *                             OR
   *                             A simple array which specifies which connections should be established.
   */
  _Class.prototype._connect = function(connection) {
    var connectionConfig = {},
      self = this;
    // Check if the connection option is an object but not an array
    if(_(connection).isObject() && !_(connection).isArray()) {
      // If it's an object, then the object keys specify the connection to use while the values should be config objects
      // for the specified connection
      // Example:
      // {
      //   db: {
      //    option1: "a",
      //    option2: "b",
      //    ...
      //  }
      // }

      // Save a reference with lower case keys
      connectionConfig = _(connection).mapKeys(_.toLowerCase);

      // Ensure the values of the connection keys are actually proper objects (not arrays, numbers, strings or whatever)
      _(connection).each(function( config ) {
        // Allowed values are: null, undefined, object (but not an array)
        if( config && (! _(config).isObject() || _(config).isArray()) ) {
          throw TypeError(messages.ConnectionConfigTypeMsg);
        }
      });

      // Overwrite the connection variable to ensure it's a simple string array; necessary for further processing
      connection = _(connectionConfig).keys();
    }
    // Ensure it's an array, if it's not an object
    else if(!_(connection).isArray()) {
      connection = [ connection ];
    }


    // Fill the connectionConfig with default values, if necessary
    _(connectionConfig).defaults(connectionDefaults);


    // Ensure the array of strings describe actually valid connection types; throw an error in case of an invalid type
    // Also ensure that the keys are actually all lower case
    connection = _(connection).map( function( value ) {
      var  objType  = typeof value;

      // Check for correct type
      if(objType === 'string') {
        // This conversion is possibly redundant, if the connection argument was an object; but whatever
        value = value.toLowerCase();

        // Is it a string which describes a valid connection function? if not, throw an error
        if(_(connectionFn[value]).isUndefined()) {
          throw new Error(messages.functions.ConnectionTypeMsgFn(value));
        }
      }
      // Invalid type
      else {
        throw new TypeError(messages.functions.TypeErrorMsgFn('string', '"connection" option', objType));
      }

      // Return the ensured lower case string
      return value;
    });

    ////////////////////
    // Public Methods //
    ////////////////////

    /**
     * Adds the given listener to the specified event. The function checks if the event name is an allowed name.
     * Alias: on
     * @param  {String} eventName
     * @param  {Function} listener
     */
    _Class.prototype.addListener = _Class.prototype.on = function(eventName, listener) {
      // Check if the given event is actually a valid one ('data' or 'error')
      if(!_(validEvents).contains(eventName)) return;

      // Add the listener to the event
      this._emitter.on(eventName, listener);
    };

    /**
     * Established all connections
     */
    _Class.prototype.connect = function() {
      // Execute the necessary connection functions which are saved in the connectionsFn object
      _(connection).each( function( type ) {
        // Execute the connection function with configuration; ensure it is called in the this-context of the DataHandler
        // Add the resulting connection object to the "private" _connection object of the instance
        self._connections[type] = connectionFn[type].connect(
          connectionConfig[type],
          // Create a suitable emitter function for the type, this ensures that the correct events get emitted on data occurrence
          self._createEmitter(type)
        );
      });
    };

    /**
     * Closes all connections
     */
    _Class.prototype.close = function() {
      // Execute the necessary connection functions which are saved in the connectionsFn object
      _(connection).each( function( type ) {
        // Execute the connection function with configuration; ensure it is called in the this-context of the DataHandler
        // Add the resulting connection object to the "private" _connection object of the instance
        self._connections[type] = connectionFn[type].close(
          connectionConfig[type]
        );
      });
    };
  };

  return _Class;
})();

////////////
// Export //
////////////

module.exports = {
  DataHandler: DataHandler
};
