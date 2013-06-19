var copywatch = require('../modules/copywatch');
var file = 'C:/Users/s.wolf/Projekte/Messdatenvisualisierung/src/test/live_test.txt';

copywatch.parsewatch(file, console.log, function() {
	setTimeout(function() {
		copywatch.unwatch(file);
	}, 15000);
});