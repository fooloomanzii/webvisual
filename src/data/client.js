var _               = require('underscore'),
    defaultPatterns = require('../config/defaultPatterns.json');

var Client = (function() {
  
//Constructor
  function _Class(socket, patterns) {
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(socket);

    this.socket = socket; // User Socket
    
    if(patterns == null) patterns = {};
    _.defaults(patterns, defaultPatterns);
    
    this.firstPattern = patterns.firstPattern; // Pattern of the first data to send
    this.appendPattern = patterns.appendPattern; // Pattern of the data to append
  }

  return _Class;
})();

////////////
//Export //
////////////

module.exports = {
  Client: Client
};