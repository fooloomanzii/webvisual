"use strict";

// Variables
var regular_expressions = {
    YYYY: "([1234][0-9]{3})", // 1000 - 4999 are valid
    MM: "(0[1-9]|1[0-2])", // 01 - 12 are valid
    DD: "(0[1-9]|[12][0-9]|3[01])", // 01 - 31 are valid
    hh: "([01][0-9]|[2][0-3])", // 00 - 23 are valid
    mm: "([0-5][0-9])", // 00 - 59 are valid
    ss: "([0-5][0-9])", // 00 - 59 are valid
    lll: "([0-9]{3})" // 000 - 999 are valid,
},

seperators = /[.;:,/\!?\"'\s]+/,

linefeed = /[\r\n\v]/,

defaults = {
  dateFormat: "DD.MM.YYYY hh:mm:ss",
  decimalSeparator: ".",
  valueSeparator: ";",
  dimensions: 1
};

class DataParser {

  constructor(options, callback) {
    this.setOptions(options, callback)
  }

  setOptions(options, callback) {
    try {
      this.options = this._initializeOptions(options);
    } catch(err) {
      if (callback)
        callback(err);
    }
  }

  /**
   * Resets the parse options so the defaults options are used again.
   */
  resetOptions() {
    this.options = undefined;
  }

  /*
    Initializes the options object
  */
  _initializeOptions(options) {
    var ret;

    if(options !== null && typeof options === 'object') {
      ret = options;
    } else {
      ret = defaults;
    }

    if (ret.dateFormat) {
      // Create Regular Expressions
      ret.dateFormatRegExp = ret.dateFormat;
        // '.' is a special character
      ret.dateFormatRegExp = ret.dateFormatRegExp.replace('.','\\.');

        // replace with given Regular Expressions (above)
      for (let key in regular_expressions) {
        ret.dateFormatRegExp = ret.dateFormatRegExp.replace(key, regular_expressions[key]);
      }
      ret.dateFormatRegExp = new RegExp(ret.dateFormatRegExp,"g");

        // create Token List for faster handling
      ret.dateFormatTokens = ret.dateFormat.split(seperators);
      ret.dateFormatTokens.filter(function(key) {
        if (regular_expressions[key] === undefined)
          return false;
        else
          return true;
      })
    }

    ret.valueFormatRegExp = new RegExp("(.)(([-+])?(\\d+(\\" + ret.decimalSeparator + ")?\\d*|\\d*(\\" + ret.decimalSeparator + ")?\\d+)(([eE]([-+])?)?\\d+)?)$","g");

    // Separator is unknown? Looks at the end of the string for the last value and takes the separator which is used before
    if (ret.valueSeparator === undefined ||
        ret.valueSeparator === 'unknown' ||
        ret.valueSeparator === '?') {
      ret.valueSeparator = defaults.valueSeparator;
    } else if(ret.valueSeparator === '??') {
      this.options.valueSeparator = '?';
    }
    // console.log(ret);
    return ret;
  }

  parse(string, callback) {
    // Check if the string is a string
    if(typeof string !== 'string') {
      return console.log("string (first argument) has to be from type string.");
    }

    // Just to be sure
    try {
      // Define Variables
      let check_val, data = { date: undefined, values: []},
        values, date, rest, counter = this.options.dimensions;

      // Split the date from string
      check_val = string.search(this.options.dateFormatRegExp);

      if (check_val === -1) {
        throw new Error("String doesn't match given dateFormat " + this.options.dateFormat + "\n" + string);
      }

      date = string.slice(0, this.options.dateFormat.length);
      rest = string.slice(this.options.dateFormat.length + 1);

      // Start the parsing the date
      data.date = this._parseDate(date);

      // Extract the values from the tokens
      values = rest.split(this.options.valueSeparator);
      // Push the values into the data.values array - as numbers.
      for (let i=0; i < values.length; i++) {
        check_val = parseFloat(values[i].replace(this.options.decimalSeparator, "."));

        if(!isNaN(check_val)) {
          if (this.options.dimensions === 1)
            data.values.push(check_val);
          else {
            if (counter === this.options.dimensions) {
              data.values.push([check_val]);
              counter = 1;
            }
            else {
              data.values[data.values.length-1].push(check_val);
              counter++;
            }
          }
        }
        else if(i !== (values.length-1) && !linefeed.test(values[i])) {
          if (values[i] === '')
            values[i] = '(value is empty)'
          throw new Error("String includes invalid numbers: " + values[i] + "\n"+string);
        }
      }
      return callback(null, data);
    } catch(err) {
      return callback(err, null);
    }
  }

  /*
    Parse the date from the input
  */
  _parseDate(dateString) {
    let date = {}, subFormat, tokens;

    tokens = dateString.split(seperators);

    for (let i=0; i < this.options.dateFormatTokens.length; i++) {
      subFormat = this.options.dateFormatTokens[i];
      date[subFormat] = tokens[i];
    }

    return new Date(date.YYYY || 0, ((date.MM || 1)-1), date.DD || 0, date.hh || 0, date.mm || 0, date.ss || 0, date.lll || 0);
  }

  /**
   *  Checks if the given type is valid format object.
   *
   *  returns boolean
   */
  _validate(type, object) {
    // if(type === undefined || type === null) return false;
    //
    // type = type.toLowerCase();
    // if(allowedOptions[type] === undefined) return false;
    //
    // var bool = true,
    //   // subbool = false,
    //   // Clone the array with the allowed options
    //   allowed = this._deep_clone(allowedOptions[type]),
    //   tmp, index;
    //
    // if(Array.isArray(object)) {
    //   for(var i=0; (i < object.length && bool); ++i) {
    //     tmp = object[i];
    //
    //     index = allowed.indexOf(tmp);
    //     if(index > -1) {
    //       // Remove the element from the allowed array
    //       allowed.splice(index, 1);
    //     } else {
    //       bool = false;
    //     }
    //   }
    // } else {
    //   bool = false;
    // }
    //
    // return bool;#
    return true;
  }
}


// Module exports
module.exports = DataParser;
