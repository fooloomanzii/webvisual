(function(){
  'use strict';
  
  // --- Variables --- //
  
  // Important DB Collection Names (!! please remove renamed collections !!)
  var devicelistDB_name = "devices"; // list of devices
  var deviceDB_prefix = "device_"; // prefix to device id
  
  // Global variables
  var max_query_limit = 5000; // maximal limit of values to query (by one request)
  
  // Dependencies
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      _        = require('underscore'),
      async    = require('async');
  
  // Schema to store the device properties
  var DeviceModel = new Schema({
      id        : String, // Measuring Device ID
      storage   : String  // Name of the Collection with Device values
    }, 
    // significant performance impact
    { autoIndex: false } // http://mongoosejs.com/docs/guide.html
  );
  
  // Schema to store the values
  var StorageModel = new Schema({      
      x       : Date,   // Time of Measure
      y       : Number, // Measured Value
      exceeds : Boolean // false = under the limit, 
                        // true = over the limit, 
                        // null = ok.
    }, 
    // significant performance impact
    { autoIndex: false } // http://mongoosejs.com/docs/guide.html
  );
  
  // Set the indexing
  DeviceModel.index( { "id": 1 } ); // index devices on ids
  StorageModel.index( { "x": 1 } ); // index values on time
  
  // --- Functions --- //
  
  /*
   * Append new Document to the Collection
   * newData - is a normal data-object
   * The 'id' is unique property = there cannot be two objects with the same id
   * ATTENSION!! 
   *    By saving new object with id of existing item, you'll get the error!
   *    to set new Properties of devise call function updateDevice()
   *    
   * Values never get overwritten or removed. They just getting appended.
   * 
   * e.g. append({id: "1", room: "room"});
   */
  DeviceModel.statics.append = function (newData, callback) {
    if(newData === undefined) return;
   
    var self = this;
    if(!_.isArray(newData)){
      return save(self, newData, function(err, appendedData){
          callback(err, appendedData);
      });
    }

    async.map(newData, function(data, callback) {
      if(data === undefined) return;
      save(self, data, callback);
    }, function(err, appendedData){
      if(err) return callback(err, appendedData);
      
      callback(err, appendedData);
    });
  };
  
  /* Private function - append()'s helper */
  function save(model, newData, callback){
    var isError = false;
    // divide newData on Values and Device properties
    var newValues = newData.values;
    delete newData.values;
    if(newValues === undefined) newValues = {};
    
    // open values collection or create new one
    model.findOne({'id':newData.id}, 
      function(err, result){
        if(err){ 
          console.warn("Some DB Error by search for device!");
          console.warn(err.stack);
          return;
        }
        
        var storage;
        if(result && result.storage){ // the device is in the list
          storage = mongoose.model(result.storage, StorageModel);
        } else { // write device to the list
          // create new collection of values and save it by device description
          newData.storage = deviceDB_prefix + newData.id;
          model.update({'id':newData.id}, newData, {upsert: true},
             function(err) {
              if (err) { 
                console.warn("Device can't be written to the list!");
                console.warn(err.stack);
              }
            }
          );
          storage = mongoose.model(newData.storage, StorageModel);
        }
        
        //TODO somehow CPU efficient check for identical values in database
        
        if(_.isEmpty(newValues)){
          callback(null, null);
        } else {
          storage.create(newValues,
            function(err) {
              if (err) { return callback(err); }
              
              callback( null, 
                { id     : newData.id,
                  values : newValues
                }
              );
            }
          );
        }
      }
    );
  }
  
  /*
   *                           !!! ATTENSION !!! 
   *   If there are no 'time' or 'limit', values may be UNSORTED BY TIME!
   *   
   * Description:  
   *  Function to search for some data and call the callback with found results
   *  Possible request properties:
   *      query - search for device/devices per id: id  : "..."
   *              default: null (all devices)
   *      time  - moment(...) : http://momentjs.com/docs/
   *                OR Date OR parameter to create new Date(parameter)
   *                OR {from: ..., to: ...} OR {from: ...} OR {to: ...}
   *                from/to is the same as 'time' (except nesting from/to)
   *                'from' is included, 'to' is excluded
   *              e.g. '2015-08-15' or 12345 (to parse Date from)
   *                   or { from: moment('2015-08-15').add(2, 'months'),
   *                        to: moment().subtract(1, 'day') }
   *              default: null
   *      limit - maximal number (integer) of values to be returned,
   *              appending on time:
   *                   (-) for values before time/time.to  (e.g. last N values)
   *                   (+) for values after time/time.from (e.g. first N values)
   *                   (0) no extra limits :)
   *              or without time:
   *                   (-) for last N values
   *                   (+) for first N values
   *                   (0) no extra limits :)
   *              default: null (no extra limits)
   *      getProperties - NOT WORKING YET!!!
   *                      false to get only id and values
   *                      true to get everything else
   *              default: true
   *      sort  - { id : 1 to specify ascending order
   *                    -1 to specify descending order }
   *              default: {id : 1}
   *                     
   * all properties are optional 
   * and need to be in the query object (order has no influence)
   * e.g. request = { query: { roomNr: "1" }, 
   *                  time:  { from: moment().subtract(1, 'months') },
   *                  sort:  { room: "-1" } }
   *      it requests data with roomNr = "1" from 1 month till now,
   *      sorted descending by room name
   * to receive all the data leave query as null : findData(null, callback)
   * or just call findData(callback);
   * 
   */
  DeviceModel.statics.query = function(request, callback, options) {
    var self = this;
    if(!_.isArray(request)){
      return find(self, request, callback);
    }
    
    var sort;
    var sortOrder;
    if(options && options.sort){
      sort = _.keys(options.sort)[0];
      sortOrder = options.sort[sort];
    } else {
      sort = 'id';
      sortOrder = 1; // default sort
    }

    async.map(request, function(query, done) {
      find(self, query, done);
    }, function(err, result){
      for(var i in result){
        result[i]=result[i][0];
      }
      result = _.sortBy(result, sort);
      if(sortOrder < 0) result = result.reverse();
      callback(err, result);
    });
  };
  
  /* Private function - query()'s helper */
  function find(model, request, callback) {
    if(!request) request = {};
    if(_.isFunction(request)){
      callback = request;
      request = {};
    }
    if(!callback) callback = function(err, results){ };
    
    var limit;
    if(request.limit){
      if(request.limit < -max_query_limit){
        request.limit = -max_query_limit
      } else if(request.limit == 0) {
        request.limit = -max_query_limit;
      } else if(request.limit > max_query_limit) {
        request.limit = max_query_limit
      } else {
        limit = request.limit;
      } 
    } else {
      limit = -max_query_limit;
    }
    /*
    var getProperties = true;
    if(request.getProperties !== undefined){
      getProperties = request.getProperties;
    }*/
    
    var time;
    if(request.time !== undefined) {
      if(request.time.from !== undefined){
        try {
          if(!time) time = {};
          time['$gte'] = new Date(request.time.from);
        } catch (e) {
          console.warn('time.from is wrong!');
          return;
        }
      }
      if(request.time.to !== undefined){
        try {
          if(!time) time = {};
          time['$lt'] = new Date(request.time.to);
        } catch (e) {
          console.warn('time.to is wrong!');
          return;
        }
      }
      if(time === undefined){ // no time.from and no time.to
        try {
          time = new Date(request.time);
        } catch (e) {
          console.warn('time is wrong!');
          return;
        }
      }
    }
    
    var sort;
    if(request.sort){
      sort = request.sort;
    } else {
      sort = { 'id' : 1 }; // default sort
    }
    
    var device_query = request.query;
    
    if(device_query === undefined){ // if no query, search for everything
      device_query = {};
    }
    
    model.find(device_query, function(err, devices) {
      if(err){
        console.warn("Error by searching for devices!");
        console.warn(err.stack);
        return;
      }
      async.map(devices, function(device, done){
        var values_collection = mongoose.model(device.storage, StorageModel);
        var query;
        if(time !== undefined){
          query = values_collection.find({ 'x': time });
        } else {
          query = values_collection.find({});
        }
        
        // limit the query
        if( limit < 0 ){
          query.sort({"x":-1})
               .limit(-limit);
        } else {
          query.sort({"x":1})
               .limit(limit);
        }
        query.select('-_id -__v');
        
        query.exec(function(err, values){
          if(err) return callback(err);
          
          // sort ascending by date
          if( limit < 0 ) _.sortBy(values, function(obj){ return obj.x; });
          
          done(null, {'id':device.id, 'values': values});
        });
      }, function(err, result){
        if(err) callback(err);
        else {
          callback(null, result);
        }
      });
    });
  };
  
  // Module exports
  module.exports = mongoose.model(devicelistDB_name, DeviceModel);

})();
