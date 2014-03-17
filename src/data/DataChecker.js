var DataChecker;

DataChecker = (function() {
  // TODO: Defaults

  // Constructor
  function _Class(opts) {
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(opts);

    // Call super constructor, if defined
    if(_Class._super) _Class._super.call(this);

    // The threshhold value
    this.min = opts.min;
    this.max = opts.max;
  }

  /**
   * Validates the given value with the saved values.
   * @param  {Number} value
   * @return {Boolean}      Is the given value in the interval?
   */
  _Class.prototype.valid = function(value) {
    return (value >= this.min && value <= this.max);
  };

  _Class.prototype.invalid = function(value) {
    return !this.valid(value);
  };

  return _Class;
})();

module.exports = DataChecker;