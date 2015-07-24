var _      = require('underscore');

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
  // return arrays
  var errArray;
  var responseArray = {};
  
  // lengts of input array
  var len;
  if(_.isArray(newDataArray)) len = newDataArray.length;
  else len = _.keys(newDataArray).length;
  
  var count = 0;
  for(var index in newDataArray){
    this.appendData(
        newDataArray[index], function (err, apiResponse) {
          if(err){
            if(!errArray) errArray = {};
            errArray[index] = err;
          }
          responseArray[index] = apiResponse;
          if(++count == len){
            callback(errArray, responseArray);
          }
    });
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
      function (err, numberAffected, status) {
        // numberAffected - the count of records that were modified, 
        // status - object with the status of the operation
        
        if (err) { // some DB Error
          return callback(err, new me.ApiResponse({ 
            success: false, 
            extras: { msg: me.ApiMessages.DB_ERROR } 
          }));
        }
        
        if (numberAffected === 1) { // data was updated or appended
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
 * calls the callback with all existing data as argument
 */
DBController.prototype.getAllData = function (callback) {
  this.dataModel.query(function (err, data) {
    callback(err, data);
  });
};

/*
 * search for some query and call the callback with found data
 * TODO how-to-use explanation
 * possible query properties:
 *      properties to search for: room: "...", unit: "...", id  : "..."
 *            default: null
 *      time: moment(...) : http://momentjs.com/docs/
 *                     OR Date OR parameter to create new Date(parameter)
 *                     OR {from: ..., to: ...} OR {from: ...} OR {to: ...}
 *                     from/to is the same as 'time' (except nesting from/to)
 *            default: null
 *      getProperties: false to get only id and values
 *                     true to get everything else
 *            default: true
 *      sort: { property : 1 to specify ascending order
 *                         -1 to specify descending order }
 *            default: {id : 1}
 *                     
 * all properties are optional 
 * and need to be in the query object (order has no influence)
 * e.g. query = {id : "1", time: moment([2010, 0, 31]).add(1, 'months') }
 * to receive all the data leave query as null : findData(null, callback)
 * or just call findData(callback);
 */
DBController.prototype.findData = function (query, callback) {
  this.dataModel.query(query, function (err, result) {
    callback(err, result);
  });
};


DBController.prototype.getTest = function (callback) {
  this.findData({getProperties: false}, callback);
};


module.exports = DBController;