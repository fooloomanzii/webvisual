var watchr = require('watchr')

var file = 'a.txt';

watchr.watch({
	path: __dirname,
	listener: function(event, filePath) { console.log(event, filePath); },
	ignoreCustomPatterns: new RegExp("^(?!.*"+file+")")
});

console.log("Started");