(function(){
	var copywatch = require('../modules/copywatch'),
		fs = require('fs');

	var file = 'parser_test.txt';

	copywatch.parsewatch(file, console.log, function() {
		/*setInterval(function() {
			fs.writeFileSync(file, "\r\n13.09.2012,19:37:00,0.000,273.526,-0.010,0.034,22.269", {flag: 'a'});
		}, 1000);*/

		/*setTimeout(function() {
			copywatch.setExtension("_copywatch");
		}, 5000);*/

		setTimeout(function() {
			fs.writeFileSync(file, "\r\n13.09.2012,19:37:00,0.000,273.526,-0.010,0.034,22.269", {flag: 'a'});
		}, 100);

		setTimeout(function() {
			copywatch.clear(false, function() {
				console.log("Cleared. Exit now.");
				process.exit(0);
			});
		}, 1000);
	});
})();