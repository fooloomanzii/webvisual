var fs = require('fs');

var file = '../../data.txt';
var today = new Date();
var first = true;
// var secplus = 0;

function threeDigitRandom(amount) {
	var string = '';

	while(--amount > -1) {
		string += ('' + (10*Math.random())).substr(0,5);
		if(amount > 0) string += ';';
	}

	return string;
}

function getProperString() {
	today = new Date();
	var seconds = today.getSeconds()/* + secplus*/;

	var tmp = (first?'':'\r\n')+
		(today.getDate() < 10 ? "0" + today.getDate() : today.getDate())+'.'+
		((today.getMonth()+1) < 10 ? "0" + (today.getMonth()+1) : (today.getMonth()+1))+'.'+
		today.getFullYear()+';'+
		(today.getHours()+':'+
		(today.getMinutes() < 10 ? "0" + today.getMinutes() : today.getMinutes())+':'+
		(seconds < 10 ? "0" + seconds : seconds))+';'+
		(threeDigitRandom(3));

	first = false;

	return tmp;
}

function getAmount(count) {
	var ret = "";

	while(--count > -1) {
		ret += getProperString();
		// ++secplus;
	}

	return ret;
}

// First write
// fs.writeFileSync(file, getAmount(10), { encoding: 'utf8'});
function test() {
	if(fs.readFileSync('../../command.txt', 'utf8') === "INTERRUPT") {
		setTimeout(test, 1000);
		return;
	}

	first = true;
	var oldContent = fs.readFileSync(file, 'utf8').split('\r\n');
	var newContent = '';

	for(var i=1; i<oldContent.length; ++i) {
		newContent += oldContent[i]+'\r\n';
	}

	for(var i=oldContent.length; i<=20; ++i) {
		newContent += getAmount(1);
	}

	fs.writeFileSync(file, newContent, { encoding: 'utf8'});
	// secplus = 0;

	setTimeout(test, 1000);
}

setTimeout(test, 1000);


// Clear the file
// fs.writeFileSync(file, "");