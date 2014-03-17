var fs = require('fs');

var file = 'live_test.txt';
var today;
var first = true;
var secplus = 0;

function threeDigitRandom() {
  return ('' + (10*Math.random())).substr(0,5);
}

function getProperString() {
  today = new Date();
  var seconds = today.getSeconds() + secplus;

  var tmp = (first?'':'\r\n')
    +(today.getDate() < 10 ? "0" + today.getDate() : today.getDate())+'.'
    +((today.getMonth()+1) < 10 ? "0" + (today.getMonth()+1) : (today.getMonth()+1))+'.'
    +today.getFullYear()+';'
    +(today.getHours()+':'
    +(today.getMinutes() < 10 ? "0" + today.getMinutes() : today.getMinutes())+':'
    +(seconds < 10 ? "0" + seconds : seconds))+';'
    +(threeDigitRandom()+';'+threeDigitRandom()+';'+threeDigitRandom());

  first = false;

  return tmp;
}

function getAmount(count) {
  var ret = "";

  while(--count > -1) {
    ret += getProperString();
    ++secplus;
  }

  return ret;
}

setInterval(function() {
  first = true;
  fs.writeFileSync(file, getAmount(3) , { encoding: 'utf8'});
  secplus = 0;
}, 1000);


// Clear the file
// fs.writeFileSync(file, "");