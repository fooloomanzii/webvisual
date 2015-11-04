var _        = require('underscore'),
    moment   = require('moment'),
    async    = require('async');


/*
 * Controls all operations over the database within defined Data Model
 *
 * dataModel - instance of mongoose.model('model name', schema);
 * logger - (not yet implemented) makes possible to log all operations;
 */
var DBController = function (dataModel) {

    this.ApiResponse = require('./api-response.js');
    this.ApiMessages = require('./api-messages.js');
    this.dataModel = dataModel;

};

/*
 * Appends data to Database.
 * Data should look like schema of the dataModel.
 * Calls the callback with possible error and success response
 * newData: can be one Object or Array of Objects
 * callback: function(err, appendedData, tmpModel);
 */
DBController.prototype.appendData = function (newData, callback) {
  // append - is custom function in the custom model
  this.dataModel.append(newData, function(err, appendedData, tmpModel){
    callback(err, appendedData, tmpModel);
  });
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
 * How to use the function read by devicedata.js/query
 */
DBController.prototype.getData = function (request, callback, options) {
  this.dataModel.query(request, function (err, result) {
    callback(err, result);
  }, options);
};


DBController.prototype.getTest = function (callback) {
  /*this.getData( [{
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
            {sort: {'id': 1}});*/
  this.getData( {
    query: { id: 'DI0-1' },
    getProperties: true
  }, callback);
};


module.exports = DBController;
