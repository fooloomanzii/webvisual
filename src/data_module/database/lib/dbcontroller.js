/**  Short description
 * Controls all operations over the database within defined DB-Models
 * Can actually check some pre-conditions of the DeviceModel/TmpModel functions.
 * 
 * To use it, at first you need to set Listeners for 'open' and 'error',
 * and then call the 'connect()' function.
 */

/** BE CAREFUL! Incorrect arguments may cause the Server termination, so   *
**              please write a correct code.                               */

// TODO comment every function!!

  // --- Node.js Module dependencies --- //
var mongoose     = require('mongoose'),
    EventEmitter = require('events').EventEmitter,
    _            = require('underscore');

  // --- Custom Module dependencies --- //
var DeviceModel = require('./devicemodel.js');

  //--- Global Variables --- //

  //--- Constructor --- //
var DBController = function() {
  // Ensure the constructor was called correctly with 'new'
  if( !(this instanceof DBController) ) return new DBController();
  
  // -- Local Variables -- //
  this.deviceModels = []; // current database connections
}

// Make it possible to emit Events
DBController.prototype = new EventEmitter;

  // --- Global Functions --- //


  // --- Local Functions --- //

DBController.prototype.checkIndex = function(index){
  if(this.deviceModels[index] === undefined)
    throw new Error("DeviceModel with index '"+ index +"' doesn't exists!!");
}

DBController.prototype.createConnection = function(options, index){
//check the options
  if(options === undefined){
    throw new Error("'options' needs to be submitted!!");
  }  
  if(options.name === undefined){
    if(_.isString(options) ) options = {name: options};
    else throw new Error("database name needs to be defined!!");
  } 
  
  var self=this;
  
  // check the index for the new device model
  if(index !== undefined) options.index = index;
  else options.index = options.name; // default index is a current db-name
  
  // check if model with that index exists
  if(this.deviceModels[options.index] !== undefined)
    throw new Error("DeviceModel with index '"+ options.index +"' is already defined!!");
  
  // Create new DeviceModel
  var newDeviceModel = new DeviceModel();
  
  // Append the model to the global array, so it can be controlled later
  this.deviceModels[options.index]=newDeviceModel; 
  
  // Initialize database and set the options if needed
  newDeviceModel.createConnection(options);
}

DBController.prototype.connect = function(index, callback){
  this.checkIndex(index);
  
  // Events forwarding
  this.deviceModels[index].on('error', function(err) { self.emit('error', err); });
  
  // Establish the connection to the model
  this.deviceModels[index].connect(callback);
};

DBController.prototype.disconnect = function(index, callback){
  this.checkIndex(index);
  this.deviceModels[index].disconnect(callback);
};

DBController.prototype.disconnectAll = function(){
  var self = this;
  async.map(this.deviceModels, 
      function(model, async_callback){
        
        // Disconnect from every model
        model.disconnect(async_callback);
      },
      function(errors, results){
        callback(errors, results);
      }
  );
};

// Creates or updates list of devices in database using given array "devices"
DBController.prototype.setDevices = function (index, devices, callback) {
  this.checkIndex(index);
  var self=this;
  // setDevice - is custom function in the dataModel
  this.deviceModels[index].setDevices(devices, function(err, model_index){
    if(callback) callback(err, model_index);
  });
};

/*
 * Appends data to Database.
 * Data should look like schema of the dataModel.
 * Calls the callback with possible error and success response
 * newData: can be one Object or Array of Objects
 * callback: function(err, appendedData);
 */
DBController.prototype.appendData = function (index, newData, callback) {
  this.checkIndex(index);
  var self=this;
  // append - is a custom function in the dataModel
  this.deviceModels[index].append(newData, function(err, appendedData, model_index){
    if(callback) callback(err, appendedData, model_index);
  });
};

/*
 * Search for some query and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getData = function (index, search_pattern, callback) {
  this.checkIndex(index);
  var self=this;
  // query - is a custom function in the dataModel
  this.deviceModels[index].query(search_pattern, function (err, result, model_index) {
    if(callback) callback(err, result, model_index);
  });
};
/*
 * Sets new fixed size in Megabytes to collection of values for given device id in given model
 */
DBController.prototype.resize = function (index, id, newSize, callback) {
  this.checkIndex(index);
  var self=this;
  this.deviceModels[index].resizeStorage(id, newSize, function (err, model_index) {
    if(callback) callback(err, model_index);
  });
};

/*
 * Sets new fixed size in Megabytes to collections of values for all devices in given model
 */
DBController.prototype.resizeAllInModel = function (index, newSize, callback) {
  this.checkIndex(index);
  var self=this;
  this.deviceModels[index].resizeAll(newSize, function (err, model_index) {
    if(callback) callback(err, model_index);
  });
};

/*
 * Sets new fixed size in Megabytes to collections of values for all devices in given model
 */
DBController.prototype.resizeAll = function (newSize, callback) {
  var self=this;
  async.forEachOf(this.deviceModels, 
      function(model, index, async_callback){
        self.resizeAllInModel(index, newSize, async_callback)
      },
      function(errors){
        if(callback) callback(errors);
      }
  );
};

//----------------- to change (start) --------------------------------//
/*
 * Search for some query in tmpDB and call the callback with found data
 * How to use the function read by devicedata.js/query
 */
//TODO merge with switch
DBController.prototype.getDataFromTmpModel = function (index, tmpDB, request, callback) {
  this.checkIndex(index);
  var self=this;
  this.deviceModels[index].TmpModel.queryFromModel(tmpDB, request, function (err, result, model_index) {
    if(callback) callback(err, result, model_index);
  });
};

/*
 * Switches Temporary Database to the next one 
 * and passes the current one per callback
 */
DBController.prototype.switchTmpDB = function (index, callback) {
  this.checkIndex(index);
  var self=this;
  this.deviceModels[index].switchTmpDB(function(tmpDB, model_index){
    self.deviceModels[index].tmpDB=tmpDB;
    callback(tmpDB, model_index);
  });
};

//----------------- to change (end) ---------------------------------//


module.exports = DBController;