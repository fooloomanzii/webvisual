var values = /[0-9]+(\.[0-9]+)?|\.[0-9]+/;
// var string = "13.09.2012,19:20:00,0.000,272.900,-0.010,0.034,22.439";
var string = "26.09.2011;18:54:00;24.85;22.45;23.97;20.60;22.71;22.27;21.56;21.46;25.40;49.41;22.49";

var seperatorFinder = new RegExp("(.)(" + values.source + ")$");
seperator = string.match(seperatorFinder)[1];

console.log(seperator);