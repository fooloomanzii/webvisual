(function(){
	'use strict';
	// Variables
	var typechecker = require('typechecker'),

		syntax = {
			year: /[12][0-9]{3}/, // 1000 - 2999 are valid
			month: /0[1-9]|1[0-2]/, // 01 - 12 are valid
			day: /0[1-9]|[12][0-9]|3[01]/, // 01 - 31 are valid
			hour: /[01][0-9]|[0-9]|2[0-3]/, // 00 - 23 are valid
			minute: /[0-5][0-9]/, // 00 - 59 are valid
			second: /[0-5][0-9]/, // 00 - 59 are valid
			values: /[0-9]+(\.[0-9]+)?|\.[0-9]+/ // Any kind of floating point number is valid
	},

		defaultOptions = {
			format: ["date", "time"],
			date: ["day", "month", "year"],
			dateSeperator: ".",
			time: ["hour", "minute", "second"],
			timeSeperator: ":"
	},

		allowedOptions = {
			format: ["date", "time"],
			date: ["day", "month", "year"],
			time: ["hour", "minute", "second"]
	};


	// Functions

	/*
		Creates an error with the specified content.
	*/
	function createError(string, pos, line) {
		var spaces;
		if(pos) {
			spaces = '';

			for(var i=0; i<pos; ++i) {
				spaces = spaces + " ";
			}
		}

		return new Error((string ? ("\""+string+"\" - ") : "") + "Error. Invalid String." +
					(pos ? ("\n"+spaces+"^") : ""),
					undefined,
					line);
	}

	/**
	 *	Parse the given string. "Returns" a object, with a date- and a values-property
	 *	The default syntax for a string is "day.month.year seperator hour:minute:second seperator values" (ignore the whitespaces)
	 *
	 *	Arguments:
	 *	string - the string to parse
	 *	seperator - a single character, seperating the tokens in the string.
	 *				alternativly seperator can be undefined, 'unknown' or '?' if the kind of seperator isn't known.
	 *				If your seperator is a '?', then give the function '??'.
	 *				The method then trys to extract the seperator from the string.
	 *	options (optional) - a object with several format options:
	 *		format - a format array with two elements for the parsing, tokens are "date", "time".
	 *				It will be assumed that there is a "seperator" between each array-element.
	 *		date - a format array with three elements for the parsing of the date, tokens are "day", "month", "year".
	 *				It will be assumed that there is a "." between each array-element.
	 *		time - a format array with three elements for the parsing of the time, tokens are "hour", "minute", "second".
	 *				It will be assumed that there is a ":" between each array-element.
	 *	callback - a callback function, gets a potential error or the generated object (err, data)
	 */
	function parse(string, seperator, options, callback) {
		if(typeof options === 'function' && callback === undefined) {
			callback = options;
		}

		// Just to be sure
		try {
			// Define Variables
			var seperatorFinder, seperatorMatch,
				tokens, token,
				fullFormat, format,
				data, extractedDate,
				match, shift,
				values, check_val,
				i, k;

			// Seperator is unknown? Looks at the end of the string for the last value and takes the seperator which is used before
			if(seperator === undefined || seperator === 'unknown' || seperator === '?') {
				seperatorFinder = new RegExp("(.)(" + syntax.values.source + ")$");

				seperatorMatch  = string.match(seperatorFinder);
				if(seperatorMatch !== null && seperatorMatch.length > 1) {
					seperator = seperatorMatch[1];
				} else {
					throw createError(string, undefined, (new Error()).lineNumber-3);
				}
			} else if(seperator === '??') {
				seperator = '?';
			} else if(seperator.length > 1 || seperator.length === 0) {
				throw createError("\""+seperator+"\" - Invalid Seperator. It has to be a single character.",
					undefined,
					(new Error()).lineNumber-3);
			}

			// Initialize the options
			if(options !== null && typeof options === 'object') {
				// General format
				// Throws a error, if the given format is invalid
				if(typeof options.format === 'undefined') {
					options.format = defaultOptions.format;
				} else if (!valid("format", options.format)) {
					throw createError('Invalid format. The format has to be an array with two elements for the parsing, tokens are "date", "time".',
						undefined,
						(new Error()).lineNumber-3);
				}

				// Date format
				// Throws a error, if the given format is invalid
				if(typeof options.date === 'undefined') {
					options.date = defaultOptions.date;
				} else if (!valid("date", options.date)) {
					throw createError('Invalid date. The date has to be an array with three elements for the parsing of the date, tokens are "day", "month", "year".',
						undefined,
						(new Error()).lineNumber-3);
				}

				// Time format
				// Throws a error, if the given format is invalid
				if(typeof options.time === 'undefined') {
					options.time = defaultOptions.time;
				} else if(!valid("time", options.time)) {
					throw createError('Invalid time. The time has to be an array with three elements for the parsing of the time, tokens are "hour", "minute", "second".',
						undefined,
						(new Error()).lineNumber-3);
				}
			} else {
				options = defaultOptions;
			}

			// Split the string into the tokens
			tokens = string.split(seperator);

			// This is just for easier handling
			fullFormat = options.format;

			// The returned data
			data = { date: undefined, values: []};
			extractedDate = {};

			// Start the parsing
			for(i=0; i<fullFormat.length; ++i) { // Exclude values
				token = tokens[i];
				format = options[fullFormat[i]]; // Get the correct format (time or date)

				shift = 0;
				for(k=0; k<format.length; ++k) {
					match = token.substring(shift).match(syntax[format[k]]);
					if(match.length < 1) throw createError(token, shift, (new Error()).lineNumber);

					extractedDate[format[k]] = match;

					shift += match.length + 1; // +1 for the seperator
				}
			}

			// Extract the values from the tokens
			values = tokens.slice(fullFormat.length);

			// Create the date
			if(fullFormat.indexOf("date") !== -1 && fullFormat.indexOf("time") !== -1) {
				// Syntax is Date(YEAR, MONTH, DAY, HOUR, MINUTE, SECOND)
				// JavaScript starts the counting of the months at 0, so we have to substract one
				data.date = new Date(extractedDate.year, (extractedDate.month-1), extractedDate.day, extractedDate.hour, extractedDate.minute, extractedDate.second);
			} else if(fullFormat.indexOf("date") !== -1) {
				data.date = new Date(extractedDate.year, extractedDate.month, extractedDate.day);
			} else {
				data.date = "No date";
			}

			// Push the values into the data.values array - as numbers.
			for(i=0; i<values.length; ++i) {
				check_val = Number(values[i]);

				if(!isNaN(check_val)) {
					data.values.push(check_val);
				}
			}

			return callback(undefined, data);
		} catch(err) {
			return callback(err, undefined);
		}
	}

	/**
	 *	Checks if the given type is valid format object. Types are "format", "date" and "time".
	 *
	 *	Arguments:
	 *	type - type of the object. Types are "format", "date" and "time".
	 *	object - An array with format specifications for the given type.
	 *
	 *	returns boolean
	 */
	function valid(type, object) {
		if(type === undefined || type === null) return false;
		else if(allowedOptions[type] === undefined) return false;

		var bool = true,
			tmp;

		if(typechecker.isArray(object) && object.length == timeLength) {
			for(var i=0; (i<object.length && bool); ++i) {
				tmp = object[i];
				/*	When the actual element is equal to one of the allowed options
					the subbool will be true */
				for(var k=0; (k<allowedOptions[type].length && !subbool); ++k) {
					subbool = subbool | (tmp === allowedOptions[type][k]);
				}

				bool = bool & subbool;
				subbool = false;
			}
		} else {
			bool = false;
		}

		return bool;
	}



	// Module exports
	module.exports.parse = parse;
})();