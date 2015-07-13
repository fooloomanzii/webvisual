(function(){
'use strict';
// Variables
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var DataSchema = new Schema({
	date: Date,
	id    : String, // Measuring Device ID
  roomNr  : Number, // Room Number
  room  : String, // Room Type
  kind  : String, // What is measured
  method   : String, // Type of Measure
  value: Number, // Measured Data
  isBoolean: Boolean, // true if Measure is boolean
  threshold: Schema.Types.Mixed, // Exceeding limits {"from":null,"to":null}
  unit: String // Measuring units
});

// Functions

// Module exports
module.exports = mongoose.model('User', UserSchema);

})();
