var copywatch = require('../modules/copywatch'),
	fs = require('fs');

var file = 'test.txt';

copywatch.watch('begin', file, function() {
	setInterval(function() {
		fs.writeFileSync(file, "\r\ntest", {flag: 'a'});
	}, 1000);

	setTimeout(function() {
		copywatch.setExtension("_copywatch");
	}, 5000);

	setTimeout(function() {
		copywatch.clear(true, function() {
			console.log("Cleared. Exit now.");
			process.exit(0);
		})
	}, 10000);
});



