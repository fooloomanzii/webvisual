(function(){
  'use strict';
  
  //--- Variables --- //
  
  // Variables
  var mongoose = require('mongoose'),
      Schema   = mongoose.Schema,
      moment   = require('moment'),
      _        = require('underscore'),
      async    = require('async');
  
  var TMPModel = new Schema({
      id        : String, // Measuring Device ID
      values    : [{       // Measured Data
        x       : Date,   // Time of Measure
        y       : Number, // Measured Value
        exceeds  : Boolean // false = under the limit, 
                          // true = over the limit, 
                          // null = ok.
      }]
    }, 
    // significant performance impact
    { autoIndex: false } // http://mongoosejs.com/docs/guide.html
  );
  
  //--- Functions --- //
  
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
  TMPModel.statics.query = function (request, callback, options) {
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
        // TODO crashes the server in worst case (if to much new data!)
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
        // {'$sort': {'values.x': 1}},
          
        // Put all found elements together, grouped by _id
        {'$group' : {
          '_id'        : '$id',
          'values'     : { '$push': '$values' }
        }}
      );
      query.push(
        {'$sort': sort}
      );
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
          results.forEach(function(item) {
            if(limit){
              if(limit<0)
                item.values = item.values.slice(limit);
              else
                item.values = item.values.slice(0, limit);
            }
            item.values.forEach(function(obj) {
              delete obj._id;
            });
            item.id = item._id;
            delete item._id;
          });
          callback(err, results);
        } else { // time  and limit are undefined
          for(var key in results){
            results[key] = { 
                id: results[key].id, 
                values: results[key].values 
            };
          }
          
          callback(err, results);
        }
      }
    );
  };
  
  // Module exports
  module.exports = TMPModel;

})();
