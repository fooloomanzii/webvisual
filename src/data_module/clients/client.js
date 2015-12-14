var _               = require('underscore'),
default_client_options = require('../defaults/default_client_options.json');

var Client = (function() {

//Constructor
  function _Class(socket, options) {
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(socket);

    this.socket = socket; // User Socket

    if(options == null) options = {};
    _.defaults(options, default_client_options);

    this.dataIndex = options.dataIndex;   // index of dataFile to watch
    this.firstPattern = options.firstPattern; // Pattern of the first data to send
    this.appendPattern = options.appendPattern; // Pattern of the data to append
  }

  return _Class;
})();

////////////
//Export //
////////////

module.exports = Client;
