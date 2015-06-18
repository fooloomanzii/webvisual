(function(){
'use strict';
// Variables
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var DataSchema = new Schema({
	date: Object,
	room: String,
	kind: String,
	method: String,
	value: Number
});

// Functions

// Module exports
module.exports = mongoose.model('User', UserSchema);

})();
