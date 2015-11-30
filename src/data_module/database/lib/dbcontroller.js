/*
 * Controls all operations over the database within defined Data Model
 * Checks all the pre-conditions of the Data Model functions
 */

/* Node.js Module Dependencies */
var mongoose     = require('mongoose'),
    EventEmitter = require('events').EventEmitter;

/* Custom Module Dependencies */
var DeviceModel = require('./devicemodel.js');

var DBController = function() { 
  
  /* Global private variables */
  var self,
// TODO !!! change functions to handle multiple dbmodels!!!
      dbmodels = [],
      dataModel;
  
  function _Class() {
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(config);
    
    self=this;
  }
  
  _Class.prototype = new EventEmitter;

  _Class.prototype.connect = function(databases){
    _(databases).map(function(config, dbname){
      var db = mongoose.createConnection("mongodb://localhost:27017/" + dbname);
      
      // Events forwarding
      db.on('error', function(err) { self.emit('error', err); });
      db.once('open', function (callback) {
        console.log("MongoDB is connected to database '%s'", dbname);
        
        var newDeviceModel = new DeviceModel(db);
        dbmodels.push( newDeviceModel.model );
        dataModel = newDeviceModel.model;
        
        newDeviceModel.init(config.database, function(err){
          if(err) { 
            err.forEach(function(error){
              self.emit('error', error);
            })
          }    
          
          self.emit('open');
        });
      });
    });
  };
  
  _Class.prototype.disconnect = function(){
    mongoose.disconnect();
  };
  
  /*
   * Creates or updates the device in database
   */
  _Class.prototype.setDevice = function (device, callback) {
    // setDevice - is custom function in the dataModel
    dataModel.setDevice(device, function(err){
      if(callback) callback(err);
    });
  };

  // Creates or updates list of devices in database using given array "devices"
  _Class.prototype.setDevices = function (devices, callback) {
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
  _Class.prototype.appendData = function (newData, callback) {
    // append - is custom function in the dataModel
    dataModel.append(newData, function(err, appendedData){
      if(callback) callback(err, appendedData);
    });
  };

  /*
   * Search for some query and call the callback with found data
   * How to use the function read by devicedata.js/query
   */
  _Class.prototype.getData = function (request, callback) {
    //query - is custom function in the dataModel
    dataModel.query(request, function (err, result) {
      if(callback) callback(err, result);
    });
  };

  /*
   * Search for some query in tmpDB and call the callback with found data
   * How to use the function read by devicedata.js/query
   */
  _Class.prototype.getDataFromModel = function (model, request, callback) {
    model.query(request, function (err, result) {
      if(callback) callback(err, result);
    });
  };

  /*
   * Switches Temporary Database to the next one 
   * and passes the current one per callback
   */
  _Class.prototype.switchTmpDB = function (callback) {
    dataModel.switchTmpDB(callback);
  };

  /*
   * Sets new fixed size in kilobytes to collection of values for given device id
   */
  _Class.prototype.resize = function (id, newSize, callback) {
    dataModel.setStorageSize(id, newSize, function (err, result) {
      if(callback) callback(err, result);
    });
  };

  /*
   * Sets new fixed size in kilobytes to collection of values for given device id
   */
  _Class.prototype.resize = function (id, newSize, callback) {
    dataModel.setStorageSize(id, newSize, function (err, result) {
      if(callback) callback(err, result);
    });
  };
  
  return _Class;
}();

module.exports = new DBController();
