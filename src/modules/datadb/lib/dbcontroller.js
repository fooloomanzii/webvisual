var _        = require('underscore'),
    moment   = require('moment'),
    async    = require('async');

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
  
  var self=this;
  async.map(newDataArray, function(newData, done) {
    self.appendData(newData, done);
  }, function(err, apiResponse){
    callback(err, apiResponse);
  });
  
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
DBController.prototype.getData = function (request, callback, options) {
  this.dataModel.query(request, function (err, result) {
    callback(err, result);
  }, options);
};


DBController.prototype.getTest = function (callback) {
  this.getData( [{
              query: { id: 'DI0-1' }, 
              time:  { from: moment().subtract(1, 'months') }, 
              getProperties: true,
              limit: 2
            }, {
              query: { id: 'DI0-2' }, 
              time:  { from: moment().subtract(1, 'months') }, 
              getProperties: false,
              limit: -1
            }], callback, 
            {sort: {'id': 1}});
  this.getData( {
    query: { id: 'DI4-4' }, 
    time:  { from: moment().subtract(1, 'months') }, 
    getProperties: true,
    limit: 2
  }, callback);
};


module.exports = DBController;