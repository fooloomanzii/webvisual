(function(){
	var fs = require('fs');

	console.log(fs.readFileSync('test.txt', {encoding: 'utf8'}));
})();