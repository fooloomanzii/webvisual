'use strict';

var
// Own modules
	copywatch = require('../modules/copywatch'),
	parser    = require('./modules/data_parser'),
// Node modules
	mailer   = require('nodemailer'),
	mongoose = require('mongoose'),
	net      = require('net'),
	_        = require('underscore'),
// Mailer variables and log in information
	mail, icsMail = require('./mail.json'),
// Class
	EventEmitter = require('events').EventEmitter,
	DataHandler;

DataHandler = (function(_Super) {
	var
		// Create the object with the connection functions
		connectionFn = {
			"db": null,
			"file": null,
			"tcp": null
		},
		defaults = {
			connection: ['file']
		};

	// Constructor
	function _Class(config) {
		// Ensure the constructor was called correctly with 'new'
		if( !(this instanceof _Class) ) return new _Class(config);

		// Call super constructor, if defined
		if(_Class._super) _Class._super.call(this);

		// Use defaults for undefined values
		_(config).defaults(defaults);

		// Validate and process the connections
		this.connect(config.connection)
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

	function _connect(connections) {
		// TODO: Make isNativeObject function
		// Check if the connection option is an object but not an array
		if(_(connections).isObject() || !_(connections).isArray()) {
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
			connections = _(connections).pairs();

			// connections is now an array with subarrays consisting from 2 values: KEY and VALUE from the old object;
			// The KEY is always a string while the VALUE should be an object
			_(connections).each(function( value ) {
				// It should be an object but not an array
				if(! _(value).isObject() || _(value).isArray() ) {
					throw TypeError("Expected simple object as config-value for connection.");
				}
			});
		}
		// Otherwise ensure it's an array
		else if(!_(connections).isArray()) {
			connections = [ connections ];
		}

		// Ensure connections is an array of strings or key, value pair arrays and an appropriate connection function exists; if not throw an error
		_(connections).each( function( value ) {
			var type = typeof value;

			// Check if it's an key, value pair array; ensure value is actually the connection type string
			if(type === 'object' && !(_(value).isArray()) {
				// First value: Type; Second value: config object
				value = value[0];
			}

			// Check for correct type
			// Is it a string which describes a valid connection function?
			if(type === 'string' && !_(connectionFn[value]).isFunction()) {
				throw new Error("The given connection type ("+value+") is invalid. Valid types are: "+_(connectionFn).functions());
			}
			// It's not an correct string? Well, wtf is it?
			else {
				throw new TypeError("Expected type of string for the 'connections' option, recieved '"+type+"'.");
			}
		});

		// Execute the necessary connection functions which are saved in the connectionsFn object
		_(connections).each( function( funcCall ) {
			var connectionConfig;

			// Check if it's an key, value pair array
			if(_(funcCall).isArray()) {
				// The second argument is the config object for the connection function
				connectionConfig = funcCall[1];
				// Ensure funcCall is an string pointing to the correct function
				funcCall = funcCall[0];
			}

			// Execute the connection function
			connectionFn[funcCall](connectionConfig);
		});
	}

	return _Class;
})(EventEmitter);


// TODO: Ermoegliche Konfiguration der Verbindungswege
/**
 * Configure Copywatch and start watching
 */
copywatch.watch('all', read_file, {
	copy: false, // We don't need to make a copy of the file
	process: parser.parse, // The used parse function
	content: validateData
});

/**
 * Configure the mail system
 * We are using an account from a mail provider (like GMail) to send mails.
 * This ensures, that the mails don't get marked as spam.
 */
mail = mailer.createTransport("SMTP", {
	service: "Gmail",
	auth: icsMail
});