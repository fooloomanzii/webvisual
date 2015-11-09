(function(){
  'use strict';
  
  /** Further Development Note
   * The following DB-Structure was chosen because of low CPU usage.
   * 
   * It was also tested { device.values = [value1, value2...] },
   * but big nested array isn't performant and needs to many CPU resources
   * for all art of operations.
   * 
   * Current version need < 1% CPU by writing, independent of DB size.
   * Read operations are always stressful.. 
   * and so it's hard to find better solution..
   **/
  
  // --- Variables --- //
  
  /* Global variables */
  // Important DB Collection Names (!! please remove renamed collections !!)
  var devicelistDB_name = "devices"; // list of devices
  var deviceDB_prefix = "device_"; // prefix to device id
   
  // maximal limit of values to query (by one request)
  var max_query_limit = 5000; 
  // default size in kb for values collections per device
  var defalut_storage_size = 50*1024; 
  
  // Dependencies
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      _        = require('underscore'),
      async    = require('async');
  
  // Mongoose Schema to store the values
  var StorageModel = new Schema({      
      x       : Date,   // Time of Measure
      y       : Number, // Measured Value
      exceeds : Boolean // false = under the limit, 
                        // true = over the limit, 
                        // null = ok.
    }, 
    // options
    { 
      // Define fixed size in bytes
      //   autoIndexId: false - shuts off the indexing by _id
      capped: { size: 1024*1024*defalut_storage_size, autoIndexId: false },
      // Versioning (__v) is important for updates. 
      // No updates => versioning is useless
      versionKey: false, // gets versioning off 
      autoIndex: false // significant performance improvement
    } 

  );
  // mongoose Schema to store the device properties
  var DeviceModel = new Schema({
      id        : String, // Measuring Device ID
      storage   : String  // Name of the Collection with Device values
    }, 
    // significant performance improvement
    { autoIndex: false } // http://mongoosejs.com/docs/guide.html
  );
  
  // Set the indexing
  DeviceModel.index( { "id": 1 } ); // index devices by id
  StorageModel.index( { "x": 1 } ); // index values on time
  
  
  // --- Functions --- //
  
  /*
   * Append new Document to the Collection
   * newData - is a normal data-object or Array of data-objects
   * ATTENSION!! 
   *    The 'id' is unique property! 
   *    There cannot be two or more devices with the same id!
   *    
   * Every device with non existed ID will be automaticly created
   * Every unnecessary property (newData.blabla) doesn't affect this operation
   * Values never get overwritten or removed. They just getting appended.
   * 
   * e.g. append({id: "1", 
   *                values: [{x=<time>, y=<value>, exceeds=false},...]
   *             }, callback);
   * or append([{id: "1", values: [..]},{id: "2", values: [..]}], callback);
   */
  DeviceModel.statics.append = function (newData, callback) {
    if(newData === undefined) return;
   
    var self = this; // allow to pass this model to global functions
    if(!_.isArray(newData)){
      return save(self, newData, function(err, appendedData){
          callback(err, appendedData);
      });
    }

    // append all data from array parallel, 
    // and pack all returned data to one array to pass it to callback
    async.map(newData, function(data, async_callback) {
      if(data === undefined) return;
      
      save(self, data, async_callback);
    }, function(err, appendedData){
      if(err) return callback(err, appendedData);

      callback(err, appendedData);
    });
  };
  
  /* Global function - append()'s helper */
  // saves the data in passed collection (model)
  function save(model, newData, callback){
    if(newData.id === undefined){ // WTF?? need an id, to arrange the values
      return callback(new Error("No id!"));
    }
    // If no values, can check the device and save if it's new
    if(newData.values === undefined) newData.values = {};
    
    // open values collection or create new one
    model.findOne({'id':newData.id}, 
      function(err, result){
        if(err){ 
          console.warn("Some DB Error by search for device!");
          console.warn(err.stack);
          return;
        }
        
        var storage;
        if(result && result.storage){ // the device is in the list and have .storage
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
        
        if(_.isEmpty(newData.values)){
          callback(null, null);
        } else {
          storage.create(newData.values,
            function(err) {
              if (err) { return callback(err); }
              
              callback( null, 
                { id     : newData.id,
                  values : newData.values
                }
              );
            }
          );
        }
      }
    );
  }
  
  /*
   * Searches for objects to match the given request
   *  Possible request properties:
   *      query - search for device/devices per id: id  : "..."
   *              default: null (all devices)
   *      time  - moment(...) : http://momentjs.com/docs/
   *                OR Date OR parameter to create new Date(parameter)
   *                OR {from: ..., to: ...} OR {from: ...} OR {to: ...}
   *                'from/to'-objects have the same structure 
   *                as 'time' without 'from/to'
   *              e.g. '2015-08-15' or 12345 (to parse Date from)
   *                   or { from: moment('2015-08-15').add(2, 'months'),
   *                        to: moment().subtract(1, 'day') }
   *              default: null
   *      limit - maximal number of values per device to be returned,
   *              appending on time:
   *                   (-) for values before time/time.to  (e.g. last N values)
   *                   (+) for values after time/time.from (e.g. first N values)
   *                   (0) last max_query_limit/(number of devices) values
   *                       before time/time.to
   *              or without time:
   *                   (-) for last N values
   *                   (+) for first N values
   *                   (0) last max_query_limit/(number of devices) values
   *              default: null (no extra limits)
   *                     
   * all request properties are optional
   * and need to be in the query object (order has no influence)
   * e.g. request = { query: { id: "1" }, 
   *                  limit: -15,
   *                  time:  { from: moment().subtract(1, 'months') }
   *                 }
   *      it requests data for device with id = "1" from 1 month till now,
   *      limited to last 15 values per device
   *      
   * you can also leave the request as null : findData(null, callback)
   * or just call findData(callback); to get data for all existing devices, 
   * last max_query_limit/(number of devices) values each device
   */
  DeviceModel.statics.query = function(request, callback) {
    var self = this;
    if(!request) request = {};
    if(_.isFunction(request)){
      callback = request;
      request = {};
    }
    if(!callback) callback = function(err, results){ };
    
    var time; // create variable time for the DB query
    if(request.time !== undefined) {
      if(request.time.from !== undefined){
        try {
          time = {};
          time['$gte'] = new Date(request.time.from);
        } catch (e) {
          return callback(new Error('requested time.from is wrong!'));
        }
      }
      if(request.time.to !== undefined){
        try {
          if(!time) time = {};
          time['$lt'] = new Date(request.time.to);
        } catch (e) {
          return callback(new Error('requested time.to is wrong!'));
        }
      }
      if(time === undefined){ // no time.from and no time.to
        try {
          time = new Date(request.time);
        } catch (e) {
          return callback(new Error('requested time is wrong!'));
        }
      }
    }
    
    var device_query = request.query;
    
    if(device_query === undefined){ // if no query, search for everything
      device_query = {};
    }
    
    self.find(device_query, function(err, devices) {
      if(err){
        return callback(err);
      }
      if(devices.length == 0) return callback(null, null);
      
      // get temporary max_limit
      var limit = max_query_limit/devices.length;
      if(request.limit){
        if(request.limit < -limit){
          limit = -limit;
        } else if(request.limit == 0) {
          limit = -limit;
        // } else if(request.limit > limit) {
        //   limit = limit;
        } else {
          limit = request.limit;
        } 
      } else {
        limit = -limit;
      }
      limit|=limit; // parse to integer without round up
      
      // does a parallel search for values for every device
      //   and packs all results in one array
      async.map(devices, function(device, done){
        // query collection with values for current device
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
        query.select('-_id -__v'); // exclude '_id' & '__v'
        
        query.exec(function(err, results){
          if(err) return done(err);

          // sort ascending by date
          if( limit < 0 ) _.sortBy(values, function(obj){ return obj.x; });
          
          done(null, {'id':device.id, 'values': results});
        });
      }, function(err, result) {
        if(err) return callback(err);
        // send all queried results from queried devices as one array back
        callback(null, result);
      });
    });
  };
  
  module.exports = mongoose.model(devicelistDB_name, DeviceModel);

})();
