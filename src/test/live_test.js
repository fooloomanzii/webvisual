var fs = require('fs');

var file = 'live_test.txt';
var today;
var first = true;

function threeDigitRandom() {
	return ('' + (10*Math.random())).substr(0,5);
}

function getProperString() {
	today = new Date();

	var tmp = (first?'':'\r\n')
		+(today.getDate() < 10 ? "0" + today.getDate() : today.getDate())+'.'
		+((today.getMonth()+1) < 10 ? "0" + (today.getMonth()+1) : (today.getMonth()+1))+'.'
		+today.getFullYear()+';'
		+(today.getHours()+':'
		+(today.getMinutes() < 10 ? "0" + today.getMinutes() : today.getMinutes())+':'
		+(today.getSeconds() < 10 ? "0" + today.getSeconds() : today.getSeconds()))+';'
		+(threeDigitRandom()+';'+threeDigitRandom()+';'+threeDigitRandom());

	first = false;

	return tmp;
}

function getAmount(count) {
	var ret = "";

	while(--count > -1) {
		ret += getProperString();
	}

	return ret;
}

setInterval(function() {
	first = true;
	fs.writeFileSync(file, getAmount(3) , { encoding: 'utf8'});
}, 1000);


// Clear the file
// fs.writeFileSync(file, "");