(function(){
  'use strict';
  // Variables
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      moment   = require('moment'),
      _        = require('underscore'),
      async    = require('async');
  
  var DeviceModel = new Schema({
  	id        : String, // Measuring Device ID
    roomNr    : String, // Room Number
    room      : String, // Room Type
    kind      : String, // What is measured
    method    : String, // Type of Measure
    threshold : Schema.Types.Object, // Thresholds: {'from':null,'to':null}
    isBoolean : Boolean, // true if Measure is boolean
    unit      : String, // Measuring units
    values    : [Schema.Types.Mixed] // Measured Data
  });
  
  // Functions
  
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
    /* model with unique name */
    var tmpModel = mongoose.model('tmp_'+(new Date()).getTime(), DeviceModel);
    var self = this;
    if(!_.isArray(newData)){
      return save(self, tmpModel, newData, function(err, appendedData){
        // remove all elements == null
        appendedData = appendedData.filter(function(n){ return n != undefined }); 
        // fill the temporary model with data from current update
        tmpModel.create(appendedData, function(err){
          callback(err, appendedData, tmpModel);
        });
      });
    }

    async.map(newData, function(data, done) {
      save(self, tmpModel, data, done);
    }, function(err, appendedData){
      // remove all elements == null
      appendedData = appendedData.filter(function(n){ return n != undefined }); 
      // fill the temporary model with data from current update
      tmpModel.create(appendedData, function(err){
        callback(err, appendedData, tmpModel);
      });
    });
  };
  
  /* Private function - append()'s helper */
  function save(model, tmpModel, newData, callback){
    
    // divide newData on Values and Device properties
    var newValues = newData.values;
    delete newData.values;
    if(newValues === undefined) newValues = {};
    
    model.find( // prevent data merging from other devices with same id
      { id: newData.id },
      function(err, result){
        if (err) return callback(err);
        
        if(result && result[0]) {
          for(var item in newData){
            // compare every property
            if(result[0][item]!==undefined && 
                !_.isEqual(result[0][item], newData[item])){
              // property is unequal
              // the changes need to be made before appending of data
              return callback(new Error("Device with same id exists!"));
            }
          }
        }
        
        if(_.isEmpty(result)){ // nothing was found ( with this.find() )
          newData.values=newValues;
          model.create(newData, callback);
        } else { // device exists -> append the values
          // build array of not existed values
          var valuesDiff = _.filter(newValues, 
            function(obj){ 
              var ret = true;
              result[0].values.forEach(
                function(value){
                  if(_.isEqual(value, obj)){
                    ret = false;
                    return;
                  }
                }
              )
              return ret;
            }
          );
          
          if(_.isEmpty(valuesDiff)){
            callback(err, null);
          } else {
            model.update(
              // criteria
              { id: newData.id },
              // just append the new values
              { $push: {values: {$each: valuesDiff} } },
              function(err) {
                if (err) { return callback(err); }
                
                callback(err, 
                    { id     : newData.id,
                      values : valuesDiff
                    }
                );
              }
            );
          }
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
   *      query - properties to search for: room: "...", unit: "...", id  : "..."
   *              default: null
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
   *      getProperties - false to get only id and values
   *                      true to get everything else
   *              default: true
   *      sort  - { property : 1 to specify ascending order
   *                          -1 to specify descending order }
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
  DeviceModel.statics.query = function (request, callback, options) {
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
      limit = request.limit;
    }
    var getProperties = true;
    if(request.getProperties !== undefined){
      getProperties = request.getProperties;
    }
    
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
          if(!limit) {
            time = new Date(request.time);
          } else if (limit < 0) {
            time['$lte'] = new Date(request.time.to);
          } else {
            time['$gte'] = new Date(request.time.from);
          }
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
    
    var query = [];
    if(request.query && !_.isEmpty(request.query)){
      query.push({'$match': request.query });
    } else {
      query.push({'$match': {} }); // null query (search for everything)
    }
    
    // different way to search with the time against without
    if(time !== undefined || limit){
      query.push(
        // Unwind the 'inventories' array
        {'$unwind' : '$values'}
      );
      if(time !== undefined){
        query.push(
          // Get only elements where 'values.x' equals mTime1
          {'$match' : { 'values.x': time } }
        );
      }
      query.push(
        // Sort values by time ascending
        {'$sort': {'values.x': 1}},
        // Put all found elements together, grouped by _id
        {'$group' : {
          '_id'        : '$id',
          'values'     : { '$push': '$values' }
        }}
      );
      if(!getProperties){ //presort results if no properties are needed
        query.push(
          {'$sort': sort}
        );
      }
    } else { // time and limit are undefined
      query.push(
        {'$sort': sort}
      );
    }
    
    //var self = this;
    model.aggregate( 
      query,
      function(err, results) {
        if(err) return callback(err);

        // different way to search with the time against without
        if(time !== undefined || limit){
          if(getProperties){
            var values = {}; // hashMap to group values by id
            results.forEach(function(item) {
              if(item.values){ // prevent empty results
                if(limit){
                  if(limit<0)
                    values[item._id] = item.values.slice(limit);
                  else
                    values[item._id] = item.values.slice(0, limit);
                } else {
                  values[item._id] = item.values;
                }
              }
            });
  
            // extend results with other properties (then 'id' and 'values')
            model.find( {id: {$in: _.keys(values)}} )
                .sort(sort)
                .exec(function(err, items) {
                  if(err) return callback(err);
      
                  items.forEach(function(item) {
                    item.values = values[item.id];
                  });

                  callback(err, items);
            });
          } else { // !getProperties
            results.forEach(function(item) {
              if(limit){
                if(limit<0)
                  item.values = item.values.slice(limit);
                else
                  item.values = item.values.slice(0, limit);
              }
              item.id = item._id;
              delete item._id;
            });
            callback(err, results);
          }
        } else { // time  and limit are undefined
          if(getProperties){
            results.forEach(function(item) {
              delete item._id;
            });
          } else { // !getProperties
            for(var key in results){
              results[key] = { 
                  id: results[key].id, 
                  values: results[key].values 
              };
            }
          }
          
          callback(err, results);
        }
      }
    );
  };
  
  // Module exports
  module.exports = mongoose.model('devicemodel', DeviceModel);

})();
