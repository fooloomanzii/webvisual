var _      = require('underscore'),
    moment   = require('moment');

/*
 * Controls all operations over the database within defined Data Model
 * 
 * dataModel - instance of mongoose.model('model name', schema);
 * logger - (not yet implemented) makes possible to log all operations;
 */
var DBController = function (dataModel, logger) {

    this.ApiResponse = require('./api-response.js');
    this.ApiMessages = require('./api-messages.js');
    this.dataModel = dataModel;
    this.logger = logger;
    
};

/*
 * Appends array with data to Database. 
 * Data should look like schema of the dataModel.
 * Calls the callback with array of possible database errors and responses
 */
DBController.prototype.appendDataArray = function (newDataArray, callback) {
  // objects to be returned
  var errArray;
  var responseArray = {};
  
  // length of input array/object
  var len;
  if(_.isArray(newDataArray)) // input is array
    len = newDataArray.length;
  else // input is object
    len = _.keys(newDataArray).length;
  
  var self=this;
  for(var index in newDataArray){
    (function(index){ //construction to pass current index to the callback
      
      // append every element in the array
      self.appendData(
        newDataArray[index], 
        function (err, apiResponse) {
          if(err){
            if(!errArray) errArray = {};
            errArray[index] = err; // append new error to return object
          }
          // append new response to return object
          responseArray[index] = apiResponse; 
          if(_.keys(responseArray).length == len){ // appending of the last object calls the callback
            callback(errArray, responseArray);
          }
        }
      );
    })(index);
  }
};

/*
 * Appends one piece of data to Database. 
 * Data should look like schema of the dataModel.
 * Calls the callback with possible error and success response
 */
DBController.prototype.appendData = function (newData, callback) {
  var me = this;

  // append - is custom function in the custom model
  me.dataModel.append(newData,
      // callback
      function (err, status) {
        // numberAffected - the count of records that were modified, 
        // status - object with the status of the operation
        
        if (err) { // some DB Error
          return callback(err, new me.ApiResponse({ 
            success: false, 
            extras: { msg: me.ApiMessages.DB_ERROR } 
          }));
        }
        
        if (status.n === 1) { // data was updated or appended
          return callback(err, new me.ApiResponse({
            success: true,
            extras: { }
          }));
        } else { // Nothing happens
          return callback(err, new me.ApiResponse({ 
            success: false, 
            extras: { msg: me.ApiMessages.COULD_NOT_PLACE_DATA } 
          }));
        }  
      }
  );
};

/*
 * Calls the callback with all existing data as argument
 */
DBController.prototype.getAllData = function (callback) {
  this.dataModel.query(function (err, data) {
    callback(err, data);
  });
};

/*
 * Search for some query and call the callback with found data
 * How to use the function read by dataModel.query
 */
DBController.prototype.findData = function (request, callback) {
  this.dataModel.query(request, function (err, result) {
    callback(err, result);
  });
};


DBController.prototype.getTest = function (callback) {
  this.findData({
    query: { id: 'DI0-1' }, 
    time:  { from: moment().subtract(1, 'months') }, 
    getProperties: true,
    limit: -1
    }, callback);
};


module.exports = DBController;