(function(){
  'use strict';
  // Variables
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      moment   = require('moment'),
      _        = require('underscore');
  
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
    
    // divide newData on Values and Device properties
    var newValues = newData.values;
    delete newData.values;
    if(newValues === undefined) newValues = {};
    
    var self = this;
    this.find( // prevent data merging from other devices with same id
      { id: newData.id },
      function(err, result){
        if (err) return callback(err);
        
        if(result && result[0]) {
          for(var item in newData){
            // compare every property
            if(result[0][item]!==undefined && 
                !_.isEqual(result[0][item], newData[item])){
              // any property is unequal
              return callback(new Error("Device with same id exists!"));
            }
          }
        }
        
        if(_.isEmpty(result)){ // nothing was found ( with this.find() )
          newData.values=newValues;
          self.update(
              // criteria
              { id: newData.id },
              newData,
              { upsert: true },
              callback
          );
        } else { // devise exists -> append the values
          self.update(
            // criteria
            { id: newData.id },
            // data, to be updated/saved
            { // prevent from identical values
              $addToSet: {values: {$each: newValues} } 
            },
            callback
          );
        }
      }
    );
  }
  
  /*
   * search for some data and call the callback with found results
   * possible request properties:
   *      query - properties to search for: room: "...", unit: "...", id  : "..."
   *              default: null
   *      time  - moment(...) : http://momentjs.com/docs/
   *                     OR Date OR parameter to create new Date(parameter)
   *                     OR {from: ..., to: ...} OR {from: ...} OR {to: ...}
   *                     from/to is the same as 'time' (except nesting from/to)
   *              default: null
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
   */
  DeviceModel.statics.query = function (request, callback) {
    if(!request) request = {};
    if(_.isFunction(request)){
      callback = request;
      request = {};
    }
    if(!callback) callback = function(err, results){ };
    
    var getProperties = true;
    if(request.getProperties !== undefined){
      getProperties = request.getProperties;
    }
    
    var time;
    if(request.time !== undefined) {
      if(request.time.from !== undefined){
        try {
          if(!time) time = {};
          time['$gte'] = new Date(moment(request.time.from));
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
      sort = {'_id' : 1}; // default sort
    }
    
    var query = [];
    if(request.query && !_.isEmpty(request.query)){
      query.push({'$match': request.query });
    } else {
      query.push({'$match': {} }); // null query (search for everything)
    }
    
    // different way to search with the time against without
    if(time !== undefined){
      query.push(
        // Unwind the 'inventories' array
        {'$unwind' : '$values'}, 
        // Get only elements where 'values.x' equals mTime1
        {'$match' : { 'values.x': time} },
        // Put all found elements together, grouped by _id
        {'$group' : {
          '_id'        : '$id',
          'values'     : {$push: '$values'}
        }}
      );
      if(!getProperties){ //presort results if no properties are needed
        query.push(
          {'$sort': sort}
        );
      }
    } else { // time is undefined
      query.push(
        {'$sort': sort}
      );
    }
    
    var self = this;
    self.aggregate( 
      query,
      function(err, results) {
        if(err) return callback(err);

        // different way to search with the time against without
        if(time !== undefined){
          if(getProperties){
            var values = {}; // hashMap to group values by id
            results.forEach(function(item) {
              if(item.values) // prevent empty results
                values[item._id] = item.values;
            });
  
            // extend results with other properties (then 'id' and 'values')
            self.find( {id: {$in: _.keys(values)}} )
                .sort(sort)
                .exec(function(err, items) {
                  if(err) return callback(err);
      
                  var results = items.map(function(item) {
                    item.values = values[item.id];
                    return item;
                  });
    
                callback(err, results);
            });
          } else { // !getProperties
            results.forEach(function(item) {
              item.id = item._id;
              delete item._id;
            });
            callback(err, results);
          }
        } else { // time is undefined
          if(getProperties){
            results.forEach(function(item) {
              delete item._id;
            });
          } else { // !getProperties
            for(key in results){
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
