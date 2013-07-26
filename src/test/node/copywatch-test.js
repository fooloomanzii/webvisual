var buster = require('buster'),
	cw = require('../../modules/copywatch');


buster.testCase("Copywatch test", {
	"set/get extension test": function() {
		assert.equals(cw.getExtension(), "_node");

		cw.setExtension("_test");

		assert.equals(cw.getExtension(), "_test");
	},
	"watch test": function() {
		var watchr,
			mode = 'all',
			file = 'copywatch-test.txt',
			options = {},
			callback = refute.defined;

			
	}
});

// buster.testCase("Copywatch private test", {

// });
