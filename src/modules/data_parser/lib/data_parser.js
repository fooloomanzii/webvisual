// Variables
var typechecker = require('typechecker');

var syntax = {
	year: /[12][0-9]{3}/, // 1000 - 2999 are valid
	month: /0[1-9]|1[0-2]/, // 01 - 12 are valid
	day: /0[1-9]|[12][0-9]|3[01]/, // 01 - 31 are valid
	hour: /[01][0-9]|2[0-3]/, // 00 - 23 are valid
	minute: /[0-5][0-9]/, // 00 - 59 are valid
	second: /[0-5][0-9]/, // 00 - 59 are valid
	values: /[0-9]+(\.[0-9]+)?|\.[0-9]+/ // Any kind of floating point number is valid
};

var defaultOptions = {
	format: ["date", "time"],
	date: ["day", "month", "year"],
	dateSeperator: ".",
	time: ["hour", "minute", "second"],
	timeSeperator: ":"
};


// Functions

/*	Parse the given string. "Returns" a object, with a date- and a values-property
	The default syntax for a string is "day.month.year seperator hour:minute:second seperator values" (ignore the whitespaces)
		string - the string to parse
		seperator - a single character, seperating the tokens in the string
		options (optional) - a object with several format options:
			format - a format array with three elements for the parsing, tokens are "date", "time".
					It will be assumed that there is a "seperator" between each array-element.
			date - a format array with three elements for the parsing of the date, tokens are "day", "month", "year".
					It will be assumed that there is a "." between each array-element.
			time - a format array with three elements for the parsing of the time, tokens are "hour", "minute", "second".
					It will be assumed that there is a ":" between each array-element.
		callback - a callback function, gets a potential error and the generated object (err, data) */
function parse(string, seperator, options, callback) {
	if(typeof options === 'function' && typeof callback === 'undefined') {
		callback = options;
	}

	// Just to be sure
	try {
		// Initialize the options
		if(options !== null && typeof options === 'object') {
			// General format
			if(typeof options.format !== 'undefined') {
				options.format = ( typechecker.isArray(options.format) ? options.format : options.format.split("seperator") );
			} else {
				options.format = defaultOptions.format;
			}

			// Date format
			if(typeof options.date !== 'undefined') {
				options.date = ( typechecker.isArray(options.date) ? options.date : options.date.split(options.dateSeperator) );
			} else {
				options.date = defaultOptions.date;
			}

			// Time format
			if(typeof options.time !== 'undefined') {
				options.time = ( typechecker.isArray(options.time) ? options.time : options.time.split(options.timeSeperator) );
			} else {
				options.time = defaultOptions.time;
			}
		} else {
			options = defaultOptions;
		}

		// Split the string into the tokens
		var tokens = string.split(seperator);
		var token;

		// This is just for easier handling
		var fullFormat = options.format;
		var format;

		// The returned data
		var data = { date: undefined, values: []};
		var extractedDate = {};

		var match, shift;
		for(var i=0; i<fullFormat.length; ++i) { // Exclude values
			token = tokens[i];
			format = options[fullFormat[i]]; // Get the correct format (time or date)

			shift = 0;
			for(var k=0; k<format.length; ++k) {
				match = token.substring(shift).match(syntax[format[k]])[0];
				extractedDate[format[k]] = match;

				shift += match.length + 1; // +1 for the seperator
			}
		}

		// Extract the values from the tokens
		var values = tokens.slice(fullFormat.length);

		// Create the date
		if(fullFormat.indexOf("date") != -1 && fullFormat.indexOf("time") != -1) {
			// Syntax is Date(YEAR, MONTH, DAY, HOUR, MINUTE, SECOND)
			data.date = new Date(extractedDate.year, extractedDate.month, extractedDate.day, extractedDate.hour, extractedDate.minute, extractedDate.second);
		} else if(fullFormat.indexOf("date") != -1) {
			data.date = new Date(extractedDate.year, extractedDate.month, extractedDate.day);
		} else {
			data.date = "No date";
		}

		// Push the values into the data.values array - as numbers.
		for(i=0; i<values.length; ++i) data.values.push(Number(values[i]));

		return callback(null, data);
	} catch(err) {
		return callback(err, null);
	}
}


// Module exports
module.exports.parse = parse;