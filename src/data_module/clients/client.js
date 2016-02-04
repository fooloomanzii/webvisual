var _ = require('underscore'),
  default_client_options = require('../defaults/default_client_options.json');

var Client = (function() {

  //Constructor
  function _Class(socket, options) {
    // Ensure the constructor was called correctly with 'new'
    if (!(this instanceof _Class)) return new _Class(socket);

    this.socket = socket; // User Socket

    if (options == null) options = {};
    // check if optons has '.patterns'
    _.defaults(options, default_client_options);

    // check every pattern for existence of important subobjects
    options.patterns.map(function(pattern) {
      _.defaults(pattern, default_client_options.patterns[0]);
      return pattern;
    });

    this.patterns = options.patterns;
  }

  return _Class;
})();

////////////
//Export //
////////////

module.exports = Client;
