var buster = require('buster'),
	data_parser = require('../../modules/data_parser');

buster.testCase("Data_parser", {
	"parse": {
		setUp: function(done) {
			var that = this;

			data_parser.parse("01.01.2013;0:00:00;0.05;0.10;0.15", function(err, data) {
				that.err = err;
				that.data = data;

				// To signal we are done
				done();
			});
		},
		"does not give an error": function() {
			refute(this.err);
		},
		"gives object": function() {
			assert(this.data);
		},
		"gives object with correct values and date": function() {
			assert.equals(this.data, {date: new Date("01.01.2013 0:00"), values: [.05, .1, .15]});
		}
	},
	"handles wrong type": function(done) {

		var counter = 3,
			count = function() {
				if(--counter === 0) {
					done();
				}
			};

		// Object
		data_parser.parse({}, function(err, data) {
			assert.defined(err, "Object:");
			refute.defined(data, "Object:");

			// Countdown
			count();
		});

		// Array
		data_parser.parse([], function(err, data) {
			assert.defined(err, "Array:");
			refute.defined(data, "Array:");

			// Countdown
			count();
		});

		// Number
		data_parser.parse(42, function(err, data) {
			assert.defined(err, "Number:");
			refute.defined(data, "Number:");

			// Countdown
			count();
		});
	}
});

buster.testCase("Data_parser private", {
	"_createDate gives a correct date": function() {
		var date = new Date(),
			dateObj = {
				year: date.getFullYear(),
				month: date.getMonth()+1,
				day: date.getDate(),
				hour: date.getHours(),
				minute: date.getMinutes(),
				second: date.getSeconds()
			};

		// We need to set the milliseconds of date to 0; otherwise it won't be equal
		date.setMilliseconds(0);

		assert.equals(data_parser._createDate(dateObj), date);
	},
	"_errString gives an proper error": function() {
		var error1 = data_parser._errString("Test"),
			error2 = data_parser._errString("Test", 5);

		refute.match(error1.message,'^');
		assert.match(error2.message, '^');
	},
	"_findSeperator finds a proper seperator": function() {
		var string = "01.01.2000|00:00:00|0.23|10.235|3.333",
			seperator = '|';

		assert.equals(seperator, data_parser._findSeperator(string));
	},
	"_findSeperator throws an exception": function() {
		var string = "asddgsdasdas";

		assert.exception(function() {
			data_parser._findSeperator(string);
		});
	},
	"_initializeOptions gives a correct options object": function() {
		var options1 = {},
			options2 = {
				format: [],
				date: [],
				time: []
			},
			newOpt = data_parser._initializeOptions(options1);

		refute.equals(newOpt, options1);
		assert.equals(newOpt, {
			format: ["date", "time"],
			date: ["day", "month", "year"],
			time: ["hour", "minute", "second"]});

		assert.equals(data_parser._initializeOptions(options2), options2);
	},
	"_parseDate gives a correct date": function() {
		var date = {
				year: 2013,
				month: 7,
				day: 17,
				hour: 16,
				minute: 31,
				second: 59
			},
			dateTokens = ["2013.07.17", "16:31:59"],
			dateOptions = {
				format: ["date", "time"],
				date: ["year", "month", "day"],
				time: ["hour", "minute", "second"]
			};

		assert.equals(data_parser._parseDate(dateTokens, dateOptions), date);

		date = {
			year: 2013,
			month: 7,
			day: 17
		};
		dateOptions = {
			format: ["date"],
			date: ["year", "month", "day"]
		};

		assert.equals(data_parser._parseDate(dateTokens, dateOptions), date);

		date = {
			year: 2013,
			month: 7,
			day: 17,
			hour: 16,
			minute: 31
		};
		dateOptions = {
			format: ["date", "time"],
			date: ["year", "month", "day"],
			time: ["hour", "minute"]
		};
		dateTokens = ["2013.07.17", "16:31"];

		assert.equals(data_parser._parseDate(dateTokens, dateOptions), date);
	},
	"_parseDate throws an error": function() {
		// Invalid format definition; missing time format
		assert.exception(function() {
			data_parser._parseDate(["2013.07.17", "16:31:59"], {
				format: ["date", "time"],
				date: ["year", "month", "day"],
				time: undefined
			});
		});
		// Invalid tokens
		assert.exception(function() {
			data_parser._parseDate(["", ""], {
				format: ["date"],
				date: ["year", "month", "day"]
			})
		});
	},
	"_validates recognizes a correct format": function() {
		var format = [
				"time",
				"date"
			],
			date = [
				"year",
				"month"
			],
			time = [],
			val = data_parser._validate;



		assert(val("format", format), "Format-Array was considered wrong.");
		assert(val("date", date), "Date-Array was considered wrong.");
		assert(val("time", time), "Time-Array was considered wrong.");
	},
	"_validates recognizes a wrong format": function() {
		var format = [
				"time",
				"space"
			],
			date = [
				"year",
				"year"
			];
			time = 20,
			val = data_parser._validate;

		refute(val("format", format), "Format-Array was considered correct.");
		refute(val("date", date), "Date-Array was considered correct.");
		refute(val("time", time), "Time-Array was considered correct.");
	}
});