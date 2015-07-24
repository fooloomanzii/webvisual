(function(){
  'use strict';
  // Variables
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      moment   = require('moment'),
      _        = require('underscore');
  
  var ValueModel = new Schema({ // Measured Data
    exceeds   : Boolean, // false = '<', null = 'ok', true = '>'
    x         : Date,    // Time of Measure
    y         : Number  // Measured Value
  });
  
  var DeviceModel = new Schema({
  	id        : String, // Measuring Device ID
    roomNr    : String, // Room Number
    room      : String, // Room Type
    kind      : String, // What is measured
    method    : String, // Type of Measure
    threshold : {'from':Number, 'to':Number}, // Thresholds: {'from':null,'to':null}
    isBoolean : Boolean, // true if Measure is boolean
    unit      : String, // Measuring units
    values    : [Schema.Types.Mixed] // Measured Data
  });
  
  // Functions
  DeviceModel.statics.append = function (newData, callback) {
    
    // divide newData on Values and Device properties
    var newValues = newData.values;
    delete newData.values;
    
    this.update(
      // criteria
      { id: newData.id },
      // data, to be updated/saved
      { $set: newData, // save/update all the fields
        $addToSet: {values: {$each: newValues}} // prevent from identical values
      },
      { upsert: true // create new Document, if nothing found by given criteria
        },
      callback
    );
  }
  
  DeviceModel.statics.query = function (criteria, callback) {
    if(!criteria) criteria = {};
    if(_.isFunction(criteria)) callback = criteria;
    if(!callback) callback = console.log; // TODO better solution
    
    var getProperties = true;
    if(criteria.getProperties !== undefined){
      getProperties = criteria.getProperties;
      delete criteria.getProperties;
    }
    
    var time;
    if(criteria.time !== undefined) {
      if(criteria.time.from !== undefined){
        try {
          if(!time) time = {};
          time['$gte'] = new Date(moment(criteria.time.from));
        } catch (e) {
          console.warn('time.from is wrong!');
          return;
        }
      }
      if(criteria.time.to !== undefined){
        try {
          if(!time) time = {};
          time['$lt'] = new Date(criteria.time.to);
        } catch (e) {
          console.warn('time.to is wrong!');
          return;
        }
      }
      if(time === undefined){ // no time.from and no time.to
        try {
          time = new Date(criteria.time);
        } catch (e) {
          console.warn('time is wrong!');
          return;
        }
      }
      
      delete criteria.time;
    }
    
    var sort;
    if(criteria.sort){
      sort = criteria.sort;
    } else {
      sort = {'_id' : 1};
    }
    
    var query = [];
    if(!_.isEmpty(criteria)){
      query.push(criteria);
    } else {
      query.push({'$match': {} });
    }
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
      )
    } else {
      if(!getProperties){
        query.push(
          // Unwind the 'inventories' array
          {'$unwind' : '$values'}, 
          // Put all found elements together, grouped by _id
          {'$group' : {
            '_id'        : '$id',
            'values'     : {$push: '$values'}
          }},
          {'$sort': sort}
        )
      } else {
        query.push(
          {'$sort': sort} // TODO add more sort criteria
        )
      }
    }
    
    var self = this;
    self.aggregate( 
      query,
      function(err, results) {
        if(err) return callback(err);

        if(time !== undefined){
          if(getProperties){
            var values = {}; // hashMap to group values by id
            results.forEach(function(item) {
              if(item.values) // prevent empty results
                values[item._id] = item.values;
            });
  
            self.find({id:{$in: _.keys(values)}})
              .sort(sort) // TODO add sort criteria
              .exec(function(err, items) {
                if(err) return callback(err);
    
                var results = items.map(function(item) {
                  item.values = values[item.id];
                  return item;
                });
    
                callback(err, results);
            });
          } else {
            results.forEach(function(item) {
              item.id = item._id;
              delete item._id;
            });
            callback(err, results);
          }
        } else {
          results.forEach(function(item) {
            if(!getProperties) item.id = item._id;
            delete item._id;
          });
          
          callback(err, results);
        }
      }
    );
  };
  
  // Module exports
  module.exports = mongoose.model('devicemodel', DeviceModel);

})();
