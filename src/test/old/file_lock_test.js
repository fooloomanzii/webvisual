var fs = require('fs'),
	file = './lock_test.txt';

var stream = fs.createWriteStream(file);

stream.write("Blabla");