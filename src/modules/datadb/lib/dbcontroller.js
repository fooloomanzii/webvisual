/*
 * Controls all operations over the database within defined Data Model
 *
 * dataModel - instance of mongoose.model('model name', schema);
 */
var DBController = function (dataModel) {
    this.dataModel = dataModel;
};

/*
 * Appends data to Database.
 * Data should look like schema of the dataModel.
 * Calls the callback with possible error and success response
 * newData: can be one Object or Array of Objects
 * callback: function(err, appendedData);
 */
DBController.prototype.appendData = function (newData, callback) {
  // append - is custom function in the custom model
  this.dataModel.append(newData, function(err, appendedData, tmpModel){
    callback(err, appendedData, tmpModel);
  });
};

/*
 * Search for some query and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getData = function (request, callback, options) {
  this.dataModel.query(request, function (err, result) {
    callback(err, result);
  }, options);
};

module.exports = DBController;
