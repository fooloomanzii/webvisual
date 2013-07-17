(function(){
	var watchr = require('watchr'),
		fs = require('fs');

	var file = 'test.txt';

	watchr.watch({
		path: file,
		listener: function(changeType, filePath, fileCurrentStat, filePreviousStat) {
			if(changeType == 'update') {
				console.log("\n\nData in the file was changed. New Data:\n");
				process.stdout.write(fs.readFileSync(file, {encoding: 'utf8'}));
			}
		}
	});
})();