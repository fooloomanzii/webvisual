/** TODO's and description
 * // TODO make a more understandable error handling!
 *
 * * Short description
 * tmpDB was implemented to store the fresh incoming data temporarily, 
 * so the clients can choose the data, they want to get.
 */

/** Further Development Note
 * The tmpDB-Structure still doesn't do a good performance 
 *    by big number of stored values
 *
 * Current structure looks out this way: 
 *                    { device = { values = [value1, value2...] } }
 * big nested array have a bad performance and need to many CPU resources
 *   for all art of operations.
 *
 * If you have any better solutions, please try to implement them!
 **/

  // --- Dependencies --- //
var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    _        = require('underscore'),
    async    = require('async');

  //--- Mongoose Schemas --- //
// Schema for every stored value
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
   _id: false, // we don't need indexed array-elements
   autoindex: false 
 }
);

// Schema for the temporary Collection
var TMPSchema = new Schema({
   // VERY IMPORTANT to use your OWN _id! (_id is a Document-index)
   // Because it's a temporary Collection, all the data needs to be frequently removed
   // But you can't remove indexes, without time-consuming, blocking db-repair operations
   // So, define your own indexes, that can be reused without a need to delete it.
   _id       : String,
   id        : String, // Measuring Device ID
   values    : [ValuesSchema] // Measured Data
 }
 // be sure, mongodb don't creates some indexes automatically! (see a comment above)
 ,{ autoindex: false } // http://mongoosejs.com/docs/guide.html
);

  // --- Constructor --- //
var TmpModel = function(deviceModel, index) {
  // It's don't really efficient to store the properties of devices more then once,
  // So, the 'query' function needs a reference to the list of devices,
  // deviceModel is that reference 
  if(!deviceModel) return new Error("deviceModel need to be defined!!");
  
  // Ensure the constructor was called correctly with 'new'
  if( !(this instanceof TmpModel) ) return new TmpModel(deviceModel);
  
  this.index = index;
  
  this.currDeviceModel = deviceModel;
  
  this.schema = TMPSchema;
}
  
  // --- Functions --- //

/*
* Append new Document to the Collection
* newData - is a normal data-object or Array of data-objects
* ATTENTION!!
*    The 'id' of device is an unique property!
*    There cannot be two or more devices with the same id!
*
* If no values were appended, callback passes null as appendedData
* Every device with non existed ID will be automatically created
* Every unnecessary property (newData.blabla) doesn't affect this operation
* Values never get overwritten or removed. They just getting appended.
*
* e.g. append({id: "1",
*                values: [{x=<time>, y=<value>, exceeds=false},...]
*             }, callback);
* or append([{id: "1", values: [..]},{id: "2", values: [..]}], callback);
*/
TmpModel.prototype.appendToModel = function (model, newData, callback) {
  var self = this;
  
  model.update(
      {'_id':newData.id }, 
      { 'id':newData.id, $pushAll: 
      { 'values' : newData.values } }, 
      { upsert: true },
      function(err){
        callback(err, newData, self.index);
      }
  );
}


// TODO describe argument 'model'
/*
 * Searches for objects to match the given request
 * Arguments actually work the same way as by devicemodel.
 * In case, if devicemodel was changed, the explanations were repeated.
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
 *              depending on time:
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
TmpModel.prototype.queryFromModel = function (model, request, callback) {
  var self = this;
  if(request === undefined) request = {}; // no request means 'request everything'
  if(_.isFunction(request)){  
   // may be the first argument is a callback
   callback = request;
   request = {};
  } else if( callback === undefined || !_.isFunction(callback) ) {
    // query is useless without a callback!
    return new Error("Database query without a callback!");
  }

  // Since it's a temporary Model, it should be possible to take all the data.
  //  so, if limit isn't defined, it's not a problem
  var limit = request.limit;

  var time; // check and parse the requested time
  if(request.time !== undefined) {
    if(request.time.from !== undefined || request.time.to !== undefined){
      if(request.time.from){ 
        try {
          time = {};
          // '$gte' is 'Greater Than or Equal'
          time['$gte'] = new Date(request.time.from);
        } catch (e) {
          return callback(new Error('requested time.from is wrong!\n'+
                          JSON.stringify(request.time.from)), null, self.index);
        }
      }
      if(request.time.to){
        try {
          if(!time) time = {};
          // '$lt' is 'Less Than'
          time['$lt'] = new Date(request.time.to);
        } catch (e) {
          return callback(new Error('requested time.to is wrong!\n'+
                         JSON.stringify(request.time.to)), null, self.index);
        }
      }
    } else { // no 'time.from' and no 'time.to'
      try {
        time = new Date(request.time);
      } catch (e) {
        return callback(new Error('requested time is wrong!\n'+
                        JSON.stringify(request.time)), null, self.index);
      }
    }
  }
  
  var device_query; // check and parse the requested devices  
  if(request.query === undefined){ // if no query, search for everything
    device_query = {};
  } else {
    device_query = _.map(request.query,
        function(item){ // change id to _id for efficiently searching
        if(item.id){ item._id=item.id; delete item.id; }
        return item;
      }
    );
  }

  // at first search for required devices in device-Collection
  // this search can look for devices depending on their properties
  // and give back their IDs
  self.currDeviceModel.find(device_query, function(err, devices) {
    if(err){
      return callback(err, null, self.index);
    }
    if(devices.length == 0) return callback(null, null, self.index);
    // get array of found IDs, to make a search in tmpDB
    devices = devices.map(function(item){return item.id});

    var query;

    // do a search for devices by id (now in tmpDB)
    query = model.find({ '_id': { $in: devices }});

    // do a search for values and limit the query
    // '_id':0 means, that we don't need the '_id' of values
    if(time){
      if(limit)
        query.select({'_id':0, 'id':1,
                     'values': { $elemMatch: { 'x': time }, $slice: limit }});
      else
        query.select({'_id':0, 'id':1, 'values': { $elemMatch: { 'x': time }}});
    } else if(limit) {
      query.select({'_id':0, 'id':1, 'values': { $slice: limit }});
    }

    query.exec(function(err, results){
      return callback(err, results, self.index);
    });
  });
};

// Module exports
module.exports = TmpModel;
