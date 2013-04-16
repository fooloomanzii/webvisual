var fs = require('fs'),
	parser = require('../modules/data_parser');

var content = fs.readFileSync('test_data.txt', 'utf8');
var lines = content.split('\r\n'); // Windows linebreak

for(var i=0; i<lines.length-2; ++i) {
	parser.parse(lines[i], ',', function(err, data) {
		if(err) {
			console.error("An error occured:", err);
		} else {
			console.log("\n\nData:", data);
		}
	});
}

parser.parse(lines[i++], ',', {format: ["date"]}, function(err, data) {
	if(err) {
		console.error("An error occured:", err);
	} else {
		console.log("\n\nData:", data);
	}
});

parser.parse(lines[i], ',', {format: []}, function(err, data) {
	if(err) {
		console.error("An error occured:", err);
	} else {
		console.log("\n\nData:", data);
	}
});