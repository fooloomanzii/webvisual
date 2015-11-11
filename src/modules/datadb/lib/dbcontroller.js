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
  this.dataModel.append(newData, function(err, appendedData){
    callback(err, appendedData);
  });
};

/*
 * Search for some query and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getData = function (request, callback) {
  this.dataModel.query(request, function (err, result) {
    callback(err, result);
  });
};

/*
 * Search for some query in tmpDB and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getDataFromModel = function (model, request, callback) {
  model.query(request, function (err, result) {
    callback(err, result);
  });
};

/*
 * Switches Temporary Database to the next one 
 * and passes the current one per callback
 */
DBController.prototype.switchTmpDB = function (callback) {
  this.dataModel.switchTmpDB(callback);
};


/*
 * Sets new fixed size in kilobytes to collection of values for given device id
 */
DBController.prototype.resize = function (id, newSize, callback) {
  this.dataModel.setStorageSize(id, newSize, function (err, result) {
    callback(err, result);
  });
};


//Test function for development cases
DBController.prototype.test = function (callback) {
  this.dataModel.test(function (err, result) {
    callback(err, result);
  });
};


module.exports = DBController;
