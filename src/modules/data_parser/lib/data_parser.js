(function(){
'use strict';
// Variables
var typechecker = require('typechecker'),

	syntax = {
		year: /[1234][0-9]{3}/, // 1000 - 2999 are valid
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

/**
 *	Parse the given string. "Returns" a object, with a date- and a values-property
 *	The default syntax for a string is "day.month.year seperator hour:minute:second seperator values" (ignore the whitespaces)
 *
 *	Arguments:
 *	string - the string to parse
 *	seperator - a single character, seperating the tokens in the string.
 *				alternativly seperator can be undefined, 'unknown' or '?' if the kind of seperator isn't known.
 *				The method then trys to extract the seperator from the string.
 *				(If your seperator is a '?' then use '??'.)
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
	} else if(typeof seperator === 'function' && callback === undefined) {
		callback = seperator;
		seperator = undefined;
	}

	// Check if the string is a string
	if(typeof string !== 'string') {
		return callback(new TypeError("string (first argument) has to be from type string."), undefined);
	}

	// Just to be sure
	try {
		// Define Variables
		var seperatorFinder, seperatorMatch,
			tokens, token,
			fullFormat, format,
			data, extractedDate,
			match, shift,
			values, check_val;

		// Seperator is unknown? Looks at the end of the string for the last value and takes the seperator which is used before
		if(seperator === undefined || seperator === 'unknown' || seperator === '?') {
			seperator = _findSeperator(string);
		} else if(seperator === '??') {
			seperator = '?';
		}

		// Initialize the options
		options = _initializeOptions(options);

		// Split the string into the tokens
		tokens = string.split(seperator);

		// This is just for easier handling
		fullFormat = options.format;

		// The returned data
		data = { date: undefined, values: []};

		// Start the parsing - extract the date
		extractedDate = _parseDate(tokens, options);

		// Extract the values from the tokens
		values = tokens.slice(fullFormat.length);

		// Create the date
		if(fullFormat.indexOf("date") !== -1) {
			// Syntax is Date(YEAR, MONTH, DAY, HOUR, MINUTE, SECOND)
			// JavaScript starts the counting of the months at 0, so we have to substract one (I know, it doesn't make sense)
			data.date = _createDate(extractedDate);
		} else {
			data.date = "No date";
		}

		// Push the values into the data.values array - as numbers.
		for(var i=0; i<values.length; ++i) {
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

/*
	A deep_clone function. A bit dumb, but an efficent way to deep-clone an object.
*/
function _deep_clone(obj) {
	return JSON.parse(JSON.stringify(obj));
};

/*
	Initializes the options object
*/
function _initializeOptions(options) {
	var returnOptions;

	if(options !== null && typeof options === 'object') {
		// returnOptions = JSON.parse(JSON.stringify(options));
		returnOptions = _deep_clone(options);

		// General format
		// Throws a error, if the given format is invalid
		if(options.format === undefined) {
			returnOptions.format = defaultOptions.format;
		} else if (!_validate("format", options.format)) {
			throw new SyntaxError('Invalid format. The format has to be an array with maximum two elements for the parsing, tokens are "date", "time".');
		}

		// Date format
		// Throws a error, if the given format is invalid
		if(options.date === undefined) {
			returnOptions.date = defaultOptions.date;
		} else if (!_validate("date", options.date)) {
			throw new SyntaxError('Invalid date. The date has to be an array with maximum three elements for the parsing of the date, tokens are "day", "month", "year".');
		}

		// Time format
		// Throws a error, if the given format is invalid
		if(options.time === undefined) {
			returnOptions.time = defaultOptions.time;
		} else if(!_validate("time", options.time)) {
			throw new SyntaxError('Invalid time. The time has to be an array with maximum three elements for the parsing of the time, tokens are "hour", "minute", "second".');
		}
	} else {
		returnOptions = defaultOptions;
	}

	return returnOptions;
}

/*
	Find the seperator
*/
function _findSeperator(string) {
	// This regular exprexion looks at the last value of the string an extracts the sign before the value; this should be the seperator
	var seperatorFinder = new RegExp("(.)(" + syntax.values.source + ")$"),
		seperatorMatch  = string.match(seperatorFinder),
		seperator;

	// Did we find a seperator?
	if(seperatorMatch !== null && seperatorMatch.length > 1) {
		seperator = seperatorMatch[1];
	}
	// If not throw an error
	else {
		throw _errString(string);
	}

	return seperator;
}

/*
	Parse the date from the input
*/
function _parseDate(tokens, options) {
	var extractedDate = {},
		subFormat, match, shift, token;

	for(var i=0; i<options.format.length; ++i) { // Exclude values
		// The token which will be parsed
		token = tokens[i];
		// Format for the parsing of the current token (be it time or date)
		subFormat = options[options.format[i]];
		// Throw an error if the subFormat isn't defined
		if(subFormat === undefined) throw new Error("\""+options.format[i]+"\"-format isn't defined in the given format.");

		// Needed to shift the token around
		shift = 0;
		for(var k=0; k<subFormat.length; ++k) {
			// Throw a regular expression on the token to parse
			match = token.substring(shift).match(syntax[subFormat[k]]);
			// If there is no match something went wrong
			if(match.length < 1) throw _errString(token, shift);

			// Save the match
			extractedDate[subFormat[k]] = parseInt(match[0], 10);

			// Shift the string
			shift += match[0].length + 1; // +1 for the seperator
		}
	}

	return extractedDate;
}

/*
	Create the date out of an object
*/
function _createDate(date) {
	// This is necessary since passing an undefined value to the Date-Constructor results in an invalid
	return new Date(date.year || 0, ((date.month || 1)-1), date.day || 0, date.hour || 0, date.minute || 0, date.second || 0);
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
function _validate(type, object) {
	if(type === undefined || type === null) return false;

	type = type.toLowerCase();
	if(allowedOptions[type] === undefined) return false;

	var bool = true,
		// subbool = false,
		// Clone the array with the allowed options
		allowed = _deep_clone(allowedOptions[type]),
		tmp, index;

	if(typechecker.isArray(object)) {
		for(var i=0; (i<object.length && bool); ++i) {
			tmp = object[i];

			index = allowed.indexOf(tmp);
			if(index > -1) {
				// Remove the element from the allowed array
				allowed.splice(index, 1);
			} else {
				bool = false;
			}

			// bool = bool & subbool;
			// subbool = false;
		}
	} else {
		bool = false;
	}

	return bool;
}

function _errString(string, pos) {
	var spaces = "";

	if(pos) {
		for(var i=0; i<pos; ++i) {
			spaces = spaces + " ";
		}
	}

	return new Error((string ? ("\""+string+"\" - ") : "") + "Error. Invalid String." +
		(pos ? ("\n"+spaces+"^") : ""),
			__filename);
}


// Module exports
module.exports = {
	// Private
	_createDate: _createDate,
	_deep_clone: _deep_clone,
	_errString: _errString,
	_findSeperator: _findSeperator,
	_initializeOptions: _initializeOptions,
	_parseDate: _parseDate,
	_validate: _validate,
	// Public
	parse: parse
};

})();