/*
 * Controls all operations over the database within defined Data Model
 * Checks all the pre-conditions of the Data Model functions
 */

// Port to the Data Model
var devicemodel = require('./devicemodel.js'),
    dataModel   = devicemodel.model;

// TODO: könnte man init als Konstruktor verwenden?
// devicemodel initializing function
function DBController (options, callback){
  devicemodel.init(options, function(err){
    if(callback) callback(err);
  });
}

/*
 * Creates or updates the device in database
 */
DBController.prototype.setDevice = function (device, callback) {
  // setDevice - is custom function in the dataModel
  dataModel.setDevice(device, function(err){
    if(callback) callback(err);
  });
};

// Creates or updates list of devices in database using given array "devices"
DBController.prototype.setDevices = function (devices, callback) {
  // setDevice - is custom function in the dataModel
  dataModel.setDevices(devices, function(err){
    if(callback) callback(err);
  });
};

/*
 * Appends data to Database.
 * Data should look like schema of the dataModel.
 * Calls the callback with possible error and success response
 * newData: can be one Object or Array of Objects
 * callback: function(err, appendedData);
 */
DBController.prototype.appendData = function (newData, callback) {
  // append - is custom function in the dataModel
  dataModel.append(newData, function(err, appendedData){
    if(callback) callback(err, appendedData);
  });
};

/*
 * Search for some query and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getData = function (request, callback) {
  //query - is custom function in the dataModel
  dataModel.query(request, function (err, result) {
    if(callback) callback(err, result);
  });
};

/*
 * Search for some query in tmpDB and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getDataFromModel = function (model, request, callback) {
  model.query(request, function (err, result) {
    if(callback) callback(err, result);
  });
};

/*
 * Switches Temporary Database to the next one
 * and passes the current one per callback
 */
DBController.prototype.switchTmpDB = function (callback) {
  dataModel.switchTmpDB(callback);
};

/*
 * Sets new fixed size in kilobytes to collection of values for given device id
 */
DBController.prototype.resize = function (id, newSize, callback) {
  dataModel.setStorageSize(id, newSize, function (err, result) {
    if(callback) callback(err, result);
  });
};

/*
 * Sets new fixed size in kilobytes to collection of values for given device id
 */
DBController.prototype.resize = function (id, newSize, callback) {
  dataModel.setStorageSize(id, newSize, function (err, result) {
    if(callback) callback(err, result);
  });
};

// DBController is a Class, because it's easier to set what need to be exported
module.exports = DBController;
