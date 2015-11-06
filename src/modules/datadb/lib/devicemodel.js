(function(){
  'use strict';
  
  // --- Variables --- //
  
  /* Global variables */
  // Important DB Collection Names (!! please remove renamed collections !!)
  var devicelistDB_name = "devices"; // list of devices
  // maximal limit of values to query (by one request)
  var max_query_limit = 5000; 
  // default limit of values to be stored per device
  var defalut_storage_limit = 1000000; 
  // number of last values in database to compare
  var values_to_compare = 5; 
  
  // Dependencies
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      _        = require('underscore'),
      async    = require('async');
  
  // mongoose Schema to store the values
  var ValuesModel = new Schema({      
      x       : Date,   // Time of Measure
      y       : Number, // Measured Value
      exceeds : Boolean // false = under the limit, 
                        // true = over the limit, 
                        // null = ok.
    }, 
    // Options
    { // spare the place by disabling "_id"
      _id: false,
      // Versioning (__v) is important for updates. 
      // No updates => versioning is useless
      versionKey: false, // gets versioning off 
      autoIndex: false // significant performance improvement
    } 

  );
  // mongoose Schema to store the device properties
  var DeviceModel = new Schema({
      id        : String, // Measuring Device ID
      storage_limit : Number,  // limit of values to be stored per device
      values    : [ValuesModel]  // Name of the Collection with Device values
    }, 
    // significant performance improvement
    { autoIndex: false } // http://mongoosejs.com/docs/guide.html
  );
  
  // Set the indexing
  DeviceModel.index( { "id": 1 } ); // index devices by id
  
  
  // --- Functions --- //
  
  /*
   * Append new Document to the Collection
   * newData - is a normal data-object or Array of data-objects
   * ATTENSION!! 
   *    The 'id' is unique property! 
   *    There cannot be two or more devices with the same id!
   *    
   * Every device with non existed ID will be automatic created
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
    
    /*model.find( // search for device
      { 'id': newData.id },
      // which properties mongodb passes to server
      { 'storage_limit' : 1 , // 1 = include, 0 = exclude
        // by array we give a number of elements we need ($slice)
        // (minus = last values, plus = first values)
        'values' : { '$slice': -values_to_compare } },
      function(err, result){
        if (err) return callback(err);
        
        if(_.isEmpty(result)){ // device with given id wasn't found
          // create new document for that device
          newData.storage_limit = defalut_storage_limit; // set limit to default
          model.create(newData, function(err, appendedData){
            delete appendedData.storage_limit; // limit is useless for callback
            callback(err, appendedData);
          });
        } else { // device exists -> append the values
          // build array of non existed values
          var valuesDiff = _.filter(newData.values, 
            function(obj){ 
              var ret = true;
              result[0].values.forEach( //
                function(value){
                  if( _.isEqual(value.x, obj.x) && _.isEqual(value.y, obj.y) ){
                    ret = false;
                    return;
                  }
                }
              )
              return ret;
            }
          );
          
          if(_.isEmpty(valuesDiff)){
            // if no new values here, we are done
            callback(err, null);
          } else {
      */
            model.update(
              // criteria
              { id: newData.id },
              // append the new values
              { $push: {values: {
                          //$each: valuesDiff, 
                          $each: newData.values
                          // limit number of elements in existing array
                          // $slice: result.storage_limit
                       }} 
              },
              //TODO Testwise!! Remove after test!
              { upsert: true },
              function(err) {
                if (err) { return callback(err); }
                
                callback(null, 
                  { id     : newData.id,
                    //values : valuesDiff
                    values : newData.values
                  }
                );
              }
            );
       /*
          }
        }
      }
    );*/
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
    
    self.find(device_query, 
        // to check the query_limit, search only for devices
        { 'id':1 }, function(err, devices) {
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
        var query;
        
        if(time !== undefined){
          query = self.find({ 'id': device.id, 'values.x': time });
        } else {
          query = self.find({ 'id': device.id });
        }
        
        // 0 = exclude, 1 = include
        query.select({  '_id': 0, // don't need _id of device by output
                        'id': 1,
                        // slice values by given limit
                        'values' : { '$slice': limit } 
        });
        
        query.exec(function(err, results){
          if(err) return done(err);
          
          done(null, results[0]);
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
