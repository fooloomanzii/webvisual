// Dependencies
var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    _        = require('underscore'),
    async    = require('async');


var TmpModel = (function(){
  //'use strict';

  // --- Variables --- //
  var currDeviceModel; // link to devicemodel
  
  //--- Mongoose Schemas --- //
  var ValuesSchema = new Schema(
    {
      x       : Date, // Time of Measure
      y       : Number, // Measured Value
      exceeds : Boolean // false = under the limit,
                        // true = over the limit,
                        // null = ok.
    },
    // options
    {
      // Versioning (__v) is important for updates.
      // No updates => versioning is useless
      versionKey: false, // gets versioning off
      _id: false,
      autoIndex: false // significant performance improvement
      // TODO check if index is registered and register it manually
    }
  );

  var TMPSchema = new Schema({
      // VERY IMPORTANT to use your OWN _id! Without it, db will endless grow!
      _id       : String,
      id        : String, // Measuring Device ID
      values    : [ValuesSchema] // Measured Data
    },
    // significant performance impact
    { autoIndex: false } // http://mongoosejs.com/docs/guide.html
  );
  
  // --- Constructor --- //
  //database is an instance of mongoose.createConnection
  function _Class(deviceModel) {
    if(!deviceModel) return new Error("database need to be defined!!");
    
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(config);
    
    currDeviceModel = deviceModel;
  }
  
  _Class.prototype.model = TMPSchema;
  
  // --- Functions --- //

// TODO: Kommentierung: wofür ist tmpmodel??? wie ist der Ablauf der Durchführung???
//      Es reicht nicht die Kommentierung der anderen Module zu kopieren bzw. nur die
//      Variablen zu beschreiben, die es nicht mal gibt!!!

  /*
   * Searches for objects to match the given request
   *  Possible request properties:
   *      query - properties to search for: {room: "..", unit: "..", id: ".."}
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
  TMPSchema.statics.query = function (request, callback) {
    var self = this;
    if(!request) request = {};
    if(_.isFunction(request)){
      callback = request;
      request = {};
    }
    if(!callback) callback = function(err, results){ };

    var limit = request.limit;

    var time; // create variable time for the DB query
    if(request.time !== undefined) {
      if(request.time.from !== undefined || request.time.to !== undefined){
        if(request.time.from){
          try {
            time = {};
            time['$gte'] = new Date(request.time.from);
          } catch (e) {
            return callback(new Error('requested time.from is wrong!'));
          }
        }
        if(request.time.to){
          try {
            if(!time) time = {};
            time['$lt'] = new Date(request.time.to);
          } catch (e) {
            return callback(new Error('requested time.to is wrong!'));
          }
        }
      } else { // no time.from and no time.to
        try {
          time = new Date(request.time);
        } catch (e) {
          return callback(new Error('requested time is wrong!'));
        }
      }
    }
    var device_query;
    if(request.query === undefined){ // if no query, search for everything
      device_query = {};
    } else {
      device_query = _.map(request.query,
          function(item){ // change id to _id for better searching
            if(item.id){ item._id = item.id; delete item.id; }
            return item;
          }
        );
    }

    currDeviceModel.find(device_query, function(err, devices) {
      if(err){
        return callback(err);
      }
      if(devices.length == 0) return callback(null, null);
      // get array of IDs
      devices = devices.map(function(item){return item.id});

      var query;

      query = self.find({ '_id': { $in: devices }});

      if(time){
        if(limit)
          query.select({'_id':0, 'id':1,
                       'values': { $elemMatch: { 'x': time }, $slice: limit }});
        else
          query.select({'_id':0, 'id':1, 'values': { $elemMatch: { 'x': time }}});
      } else if(limit) {
        query.select({'_id':0, 'id':1, 'values': { $slice: limit }});
      }
// TODO Kommentierung: was wird hier gelöscht???
      query.exec(function(err, results){
        if(err) return callback(err);
        results.forEach(function(item) {
          delete item._id;
        });
        callback(err, results);
      });
    });
  };
  
  return _Class;
})();

// Module exports
module.exports = TmpModel;
