function escape_RegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function create_ignore_pattern(string) {
	var rString = '(';

	for(var i=0; i<string.length; ++i) {
		rString += escape_RegExp(string.substr(0,i))+'[^'+escape_RegExp(string.charAt(i))+']';
		if(i+1 < string.length) rString += '|';
	} rString += ')';

	return rString;
}

var fs = require('fs'),
	fileName = "live_test.txt",
	wrongName = "parser_test.txt",
	// regExp = new RegExp("^(?!"+escapeRegExp(fileName)+").*", "gmi"),
	regExp = new RegExp(create_ignore_pattern(fileName), "gi"),
	files = fs.readdirSync('.'),
	filesString = '';

// for(var i=0; i<files.length; ++i) {
// 	filesString += files[i];
// 	if(i+1<files.length) filesString += '\n';
// }

for(var i=0; i<files.length; ++i) {
	console.log(files[i], ' - ', regExp.test(files[i]));
}

console.log(regExp.source);

// console.log(escapeRegExp(fileName));

// console.log(filesString);

// console.log(filesString.match(regExp));

// console.log(regExp.test(fileName));

// console.log(regExp.test(wrongName));