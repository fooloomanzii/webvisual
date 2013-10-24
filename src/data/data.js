// jshint unused:false
'use strict';

var
// Own modules
	copywatch = require('../modules/copywatch'),
	parser    = require('./modules/data_parser'),
// Node modules
	mailer   = require('nodemailer'),
	mongoose = require('mongoose'),
	net      = require('net'),
	pathing  = require('path'),
	_        = require('underscore'),
// Mailer variables and log in information
	mail, icsMail = require('./mail.json'),
// Class
	EventEmitter = require('events').EventEmitter,
	DataHandler,
// Config & Co
	connectionDefaults = {
		"db": {
			// Default DB configuration
		},
		"file": {
			// Default file: Same dir as the "master" script
			path: pathing.join(__dirname, 'data.txt')
		},
		"tcp": {
			// Default TCP configuration
		}
	},
	// All connect functions for the different connection types
	connectionFn = {
		"db": null,
		"file": null,
		"tcp": null
	},
	messages = {
		ConnectionConfigType : "Expected simple object as config-value for connection.",
		ConnectionType       : function(connectionType) {
			return "The given connection type \""+connectionType+"\" is invalid. Valid types are: "+_(connectionFn).functions();
		},
		TypeErrorMsg         : function(expectedType, forWhat, recievedType) {
			// Returns a descriptive message dependend on the arguments
			return "Expected \""+expectedType+"\"-type"+
			(forWhat ? " for "+forWhat : "")+
			(recievedType ? ", recieved \""+recievedType+"\"" : "")+".";
		}
	};

DataHandler = (function(_Super) {
	// jshint validthis:true
	var defaults = {
			connection: ['file']
		};

	// jshint newcap: false
	// Constructor
	function _Class(config) {
		// Ensure the constructor was called correctly with 'new'
		if( !(this instanceof _Class) ) return new _Class(config);

		// Call super constructor, if defined
		if(_Class._super) _Class._super.call(this);

		// Use defaults for undefined values
		_(config).defaults(defaults);

		// Validate and process the connections
		this.connect(config.connection);
	}

	// Inherit from EventEmitter
	_Class._super = _Super;
	_Class.prototype = Object.create(_Super.prototype, {
		constructor: {
			value: _Class,
			enumerable: false,
			writable: true,
			configurable: true
		}
	});

	// Extend with methods
	_(_Class.prototype).extend({
		connect: _connect,
	});



	/////////////
	// Methods //
	/////////////
	function _connect(connection) {
		var connectionConfig = {};
		// Check if the connection option is an object but not an array
		if(_(connection).isObject() || !_(connection).isArray()) {
			// If it's an object, then the object keys specify the connection to use while the values should be config objects
			// for the specified connection
			// Example:
			// {
			// 	db: {
			//		option1: "a",
			//		option2: "b",
			//		...
			//	}
			// }

			// Save a reference with lower case keys
			for(var key in connection) {
				connectionConfig[key.toLowerCase()] = connection[key];
			}

			// Ensure the values of the connection keys are actually proper objects (not arrays, numbers, strings or whatever)
			_(connection).each(function( config ) {
				// Allowed values are: null, undefined, object (but not an array)
				if( config && (! _(config).isObject() || _(config).isArray()) ) {
					throw TypeError(messages.WrongConnectionConfigType);
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
			var	objType  = typeof value;

			// Check for correct type
			if(objType === 'string') {
				// This conversion is possibly redundant, if the connection argument was an object; but whatever
				value = value.toLowerCase();

				// Is it a string which describes a valid connection function? if not, throw an error
				if(!_(connectionFn[value]).isFunction()) {
					throw new Error(messages.ConnectionType(objType));
				}
			}
			// Invalid type
			else {
				throw new TypeError(messages.TypeErrorMsg('string', '"connection" option', objType));
			}

			// Return the ensured lower case string
			return value;
		});


		// Execute the necessary connection functions which are saved in the connectionsFn object
		_(connection).each( function( value ) {
			// Execute the connection function with configuration
			// TODO: Save the connections
			connectionFn[value](connectionConfig[value]);
		});
	}

	return _Class;
})(EventEmitter);

// jshint ignore:start
function fileConnect(config) {
	copywatch.watch('all', read_file, {
		copy: false, // We don't need to make a copy of the file
		process: parser.parse, // The used parse function
		content: validateData
	});
}
// jshint ignore:end

/**
 * Configure the mail system
 * We are using an account from a mail provider (like GMail) to send mails.
 * This ensures, that the mails don't get marked as spam.
 */
mail = mailer.createTransport("SMTP", {
	service: "Gmail",
	auth: icsMail
});