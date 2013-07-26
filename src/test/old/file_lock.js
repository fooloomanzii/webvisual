var fs = require('fs'),
	lockfile = require('lockfile'),
	file = './lock_test.txt',
	bla = 0;

lockfile.lock(file, function(err) {
	if(err) console.log(err);
	while(true) bla=0;
});