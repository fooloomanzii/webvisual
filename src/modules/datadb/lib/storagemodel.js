(function(){
  'use strict';
  
  // --- Variables --- //
  
  // Global variables
  var values_to_compare = 1; // number of last values in database to compare
  var max_limit = 100;
  var num_of_tmps = 15;
  var cur_tmp = 0;
  
  // Dependencies
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      moment   = require('moment'),
      _        = require('underscore'),
      async    = require('async'),
      tmpModel = require('./tmpdata.js');
  
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
  StorageModel.index( { "x": 1 } );
  
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
  function append(newData, callback) {
    if(newData === undefined) return;
    /* model with unique name */
    var tmpDB = mongoose.model('tmp_'+cur_tmp, tmpModel);
    cur_tmp = (cur_tmp + 1) % num_of_tmps;
    
    var self = this;
    if(!_.isArray(newData)){
      return save(newData, function(err, appendedData){
        // remove all elements == null
        appendedData = appendedData.filter(function(n){ return n != undefined }); 
        // fill the temporary model with data from current update
        tmpDB.create(appendedData, function(err){
          callback(err, appendedData, tmpDB);
        });
      });
    }

    async.map(newData, function(data, callback) {
      if(data === undefined) return;
      save(data, callback);
    }, function(err, appendedData){
      // remove all elements == null
      appendedData = appendedData.filter(function(n){ return n != undefined });
      if(err) return callback(err, appendedData);
      // fill the temporary model with data from current update
      tmpDB.create(appendedData, function(err){
        callback(err, appendedData, tmpDB);
      });
    });
  };
  
  /* Private function - append()'s helper */
  function save(newData, callback){
    // divide newData on Values and Device properties
    var newValues = newData.values;
    if(newValues === undefined) newValues = {};
    
    // open values collection or create new one
    var storage = mongoose.model('device_'+newData.id, StorageModel);
    
    //TODO prevent data merging from other devices with same id
    
    // build array of non existed values
    async.forEachOf(newValues, function(value, pos, callback){
        storage.findOne({'x':value.x, 'y':value.y},
          function(err, result){
            if (err) return callback(err);
            // something found => value exists
            if(!_.isEmpty(result)) newValues[pos]=null;
            callback();
          }
        );
      }, function(err){
        // remove nulls = removed values
        newValues = newValues.filter(function(val) { return val; });
        
        if(_.isEmpty(newValues)){
          callback(null, null);
        } else {
          storage.create(newValues,
            function(err) {
              if (err) { return callback(err); }
              
              callback( null, 
                { id     : newData.id.toLowerCase(),
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
  function query(request, callback, options) {
    var self = this;
    if(!_.isArray(request)){
      return find(request, callback);
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
      find(query, done);
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
  function find(request, callback) {
    if(!request) request = {};
    if(_.isFunction(request)){
      callback = request;
      request = {};
    }
    if(!callback) callback = function(err, results){ };
    
    var limit;
    if(request.limit){
      if(request.limit < -max_limit){
        request.limit = -max_limit
      } else if(request.limit == 0) {
        request.limit = -max_limit;
      } else if(request.limit > max_limit) {
        request.limit = max_limit
      } else {
        limit = request.limit;
      } 
    } else {
      limit = -max_limit;
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
      sort = {'id' : 1}; // default sort
    }
    
    mongoose.connection.db.listCollections().toArray(function(err, names) {
      var devices = names.map(function(name){
        var id = name.name.match(/^device_(.*?)$/);
        if(!id) return null;
        if(request.query && request.query.id){
          if(_.indexOf(request.query.id, id[1]) > -1){
            name.id = id[1];
            return name;
          } else {
            return null;
          }
        } else {
          name.id = id[1];
          return name;
        }
      });
      
      // remove nulls = removed devices
      devices = devices.filter(function(val) { return val; });
      
      async.map(devices, function(name, done){
        var device = mongoose.model(name.name, StorageModel);
        var query;
        if(time !== undefined){
          query = device.find({ 'x': time });
        } else {
          query = device.find({});
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
          
          done(null, {'id':name.id, 'values': values});
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
  module.exports = {
    'append': append,
    'query' : query
  };

})();
