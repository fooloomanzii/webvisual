var fs = require('fs');

var readstream = fs.createReadStream('test.txt');
readstream.setEncoding('utf8');
readstream.on('data', function(data) {
	process.stdout.write(data);
});