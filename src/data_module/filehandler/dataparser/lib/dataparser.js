// Variables
var regular_expressions = {
    YYYY: /[1234][0-9]{3}/, // 1000 - 4999 are valid
    YY: /[0-9]{2}/, // 1000 - 4999 are valid
    MM: /0[1-9]|1[0-2]/, // 01 - 12 are valid
    DD: /0[1-9]|[12][0-9]|3[01]/, // 01 - 31 are valid
    hh: /[01][0-9]|[2][0-3]/, // 00 - 23 are valid
    mm: /[0-5][0-9]/, // 00 - 59 are valid
    ss: /[0-5][0-9]/, // 00 - 59 are valid
    llll: /[0-9]{3}/ // 0000 - 9999 are valid
},

allowedOptions = {
  format: ["date", "time"],
  date: ["DD", "MM", "YYYY"],
  time: ["hh", "mm", "ss", "llll"]
},

defaults = {
  format: ["date", "time"],
  date: ["DD", "MM", "YYYY"],
  dateSeparator: ".",
  time: ["hh", "mm", "ss"],
  timeSeparator: ":",
  decimalSeparator: ".",
  valueSeparator: ";",
  dimensions: 1
};

// PUBLIC

/**
 * Sets the parse options. If the parse function doesn't recieve any options this options are used rather than the defaults options.
 *
 * Arguments:
 * {options} - a object with several format options:
 *    [format] - a format array with two elements for the parsing, tokens are "date", "time".
 *        It will be assumed that there is a "separator" between each array-element.
 *    [date] - a format array with three elements for the parsing of the date, tokens are "DD", "MM", "YYYY".
 *        It will be assumed that there is a "." between each array-element.
 *    [time] - a format array with three elements for the parsing of the time, tokens are "hh", "mm", "ss".
 *        It will be assumed that there is a ":" between each array-element.
 * callback - a callback-function that recieves an potential error.
 */

class DataParser {

  constructor(options) {
    this.setOptions(options)
  }

  setOptions(options) {
    try {
      this.options = this._initializeOptions(options);
    } catch(err) {
      console.log("Parser - Options", err);
    }
  }

  /**
   * Resets the parse options so the defaults options are used again.
   */
  resetOptions() {
    this.options = undefined;
  }


  /**
   *  Parse the given string. "Returns" a object, with a date- and a values-property
   *  The defaults regular_expression for a string is "DD.MM.YYYY separator hh:mm:ss separator values" (ignore the whitespaces)
   *
   *  Arguments:
   *  "string" - the string to parse
   *  'separator' - a single character, seperating the tokens in the string.
   *        alternativly separator can be undefined, 'unknown' or '?' if the kind of separator isn't known.
   *        The method then trys to extract the separator from the string.
   *        (If your separator is a '?' then use '??'.)
   *  {options} (optional) - a object with several format options:
   *    [format] - a format array with two elements for the parsing, tokens are "date", "time".
   *        It will be assumed that there is a "separator" between each array-element.
   *    [date] - a format array with three elements for the parsing of the date, tokens are "DD", "MM", "YYYY".
   *        It will be assumed that there is a "." between each array-element.
   *    [time] - a format array with three elements for the parsing of the time, tokens are "hh", "mm", "ss".
   *        It will be assumed that there is a ":" between each array-element.
   *  callback - a callback function, gets a potential error or the generated object (err, data)
   */
  parse(string, callback) {

    // Check if the string is a string
    if(typeof string !== 'string') {
      return console.log("string (first argument) has to be from type string.");
    }
    this.options = defaults;
    console.log(this.options);
    // Just to be sure
    try {
      // Define Variables
      let tokens, data, extractedDate, values, check_val;

      // Separator is unknown? Looks at the end of the string for the last value and takes the separator which is used before
      if (this.options.valueSeparator === undefined ||
          this.options.valueSeparator === 'unknown' ||
          this.options.valueSeparator === '?') {
        this.options.valueSeparator = this._findValueSeparator(string);
      } else if(this.options.valueSeparator === '??') {
        this.options.valueSeparator = '?';
      }

      // Split the string into the tokens
      tokens = string.split(this.options.valueSeparator);

      // The returned data
      data = { date: undefined, values: []};

      // Start the parsing - extract the dateTime
      extractedDate = this._parseDate(tokens[0], this.options);

      // Extract the values from the tokens
      values = tokens.slice(this.options.format.length);

      // Create the date
      if(fullFormat.indexOf("date") !== -1) {
        // Syntax is Date(YYYY, MM, DD, hh, mm, ss, llll)
        // JavaScript starts the counting of the months at 0, so we have to substract one (I know, it doesn't make sense)
        data.date = this._createDate(extractedDate);
      }

      // Push the values into the data.values array - as numbers.
      for (let i=0; i < values.length; ++i) {
        check_val = parseFloat(values[i].replace(separator, "."));

        if(!isNaN(check_val)) {
          data.values.push(check_val);
        }
      }

      return callback(null, data);
    } catch(err) {
      console.log(err);
      return callback(err, null);
    }
  }

  /*
    A deep_clone function. A bit dumb, but an efficent way to deep-clone an object.
  */
  _deep_clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /*
    Initializes the options object
  */
  _initializeOptions(options) {
    var returnOptions;

    if(options !== null && typeof options === 'object') {
      // returnOptions = JSON.parse(JSON.stringify(options));
      returnOptions = this._deep_clone(options);

      // General format
      // Throws a error, if the given format is invalid
      if (options.format === undefined) {
        returnOptions.format = defaults.format;
      } else if (!this._validate("format", options.format)) {
        console.log('Invalid format. The format has to be an array with maximum two elements for the parsing, tokens are "date", "time".');
      }

      // Date format
      // Throws a error, if the given format is invalid
      if (options.date === undefined) {
        returnOptions.date = defaults.date;
      } else if (!this._validate("date", options.date)) {
        console.log('Invalid date. The date has to be an array with maximum three elements for the parsing of the date, tokens are "DD", "MM", "YYYY".');
      }

      // Time format
      // Throws a error, if the given format is invalid
      if (options.time === undefined) {
        returnOptions.time = defaults.time;
      } else if(!this._validate("time", options.time)) {
        console.log('Invalid time. The time has to be an array with maximum three elements for the parsing of the time, tokens are "hh", "mm", "ss".');
      }
    } else {
      returnOptions = defaults;
    }

    return returnOptions;
  }

  /*
    Find the separator
  */
  _findValueSeparator(string) {
    // This regular exprexion looks at the last value of the string and extracts the sign before the value; this should be the separator
    let separatorFinder = new RegExp("(.)(" + "([-+])?(\\d+(\\" + this.options.decimalSeparator + ")?\\d*|\\d*(\\" + this.options.decimalSeparator + ")?\\d+)(([eE]([-+])?)?\\d+)?" + ")$"),
      separatorMatch  = string.match(separatorFinder),
      separator;

    // Did we find a separator?
    if(separatorMatch !== null && separatorMatch.length > 1) {
      separator = separatorMatch[1];
    }
    // If not throw an error
    else {
      this._errString(string);
    }

    return separator;
  }

  /*
    Parse the date from the input
  */
  _parseDate(token, options) {
    let extractedDate = {}, subFormat, match;

    for (let i=0; i < this.options.format.length; ++i) { // Exclude values
      // Format for the parsing of the current token (be it time or date)
      subFormat = this.options[options.format[i]];
      // Throw an error if the subFormat isn't defined
      if (subFormat === undefined)
        console.log("\""+options.format[i]+"\"-format isn't defined in the given format.");

      // Start parsing
      for (var k=0; k < subFormat.length; ++k) {
        // Throw a regular expression on the token to parse
        match = token.match(regular_expressions[subFormat[k]]);
        // If there is no match something went wrong
        if(match.length < 1)
          this._errString(token, shift);

        // Save the match
        extractedDate[subFormat[k]] = parseInt(match[0], 10);

        // Shift the string
        token = token.substr(match[0].length + 1); // +1 for the separator
      }
    }

    return extractedDate;
  }

  /*
    Create the date object
  */
  _createDate(date) {
    // This is necessary since passing an undefined value to the Date-Constructor results in an invalid
    return new Date(date.YYYY || 0, ((date.MM || 1)-1), date.DD || 0, date.hh || 0, date.mm || 0, date.ss || 0, date.llll || 0);
  }

  /**
   *  Checks if the given type is valid format object. Types are "format", "date" and "time".
   *
   *  Arguments:
   *  type - type of the object. Types are "format", "date" and "time".
   *  object - An array with format specifications for the given type.
   *
   *  returns boolean
   */
  _validate(type, object) {
    if(type === undefined || type === null) return false;

    type = type.toLowerCase();
    if(allowedOptions[type] === undefined) return false;

    var bool = true,
      // subbool = false,
      // Clone the array with the allowed options
      allowed = this._deep_clone(allowedOptions[type]),
      tmp, index;

    if($.isArray(object)) {
      for(var i=0; (i < object.length && bool); ++i) {
        tmp = object[i];

        index = allowed.indexOf(tmp);
        if(index > -1) {
          // Remove the element from the allowed array
          allowed.splice(index, 1);
        } else {
          bool = false;
        }
      }
    } else {
      bool = false;
    }

    return bool;
  }

  _errString(string, pos) {
    var spaces = "";

    if(pos) {
      for(var i=0; i<pos; ++i) {
        spaces = spaces + " ";
      }
    }

    console.log((string ? ("\""+string+"\" - ") : "") + "Error. Invalid String." +
      (pos ? ("\n"+spaces+"^") : ""),
        __filename);
  }

}


// Module exports
module.exports = DataParser;
