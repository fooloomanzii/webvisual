/** Short description
 * devicemodel handles the mongoDB-Collection with a list of devices,
 * and Collections with stored values.
 * Also, after storing the fresh incoming data,
 *   it passes that to the tmpmodel for further storage.
 * You can access tmpDB only by switching them! (calling the switching function)
 */

/** Further Development Note
 * The following DB-Structure was chosen because of low CPU usage.
 *
 * It was also tested to make a collection to look like:
 *                    { device = { <someProperties>,
 *                                 values = [value1, value2...] }
 *                    },
 * but big nested array have a bad performance and need to many CPU resources
 *   for all art of operations.
 *
 * Current version needs < 1% CPU by writing (per DB), independent of DB size.
 * Read operations are always stressful..
 * It isn't really possible to find better solutions..
 *   .. may be only after some mongoDB updates.
 *   (current mongoDB Version: 3.0.7 | Storage Engine: MMAPv1 )
 **/

  // --- Node.js Module dependencies --- //
var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    EventEmitter = require('events').EventEmitter,
    _        = require('underscore'),
    async    = require('async');

// --- Custom Module dependencies --- //
var TmpModel = require('./tmpmodel.js');

  //--- Global variables --- //
// DB Collection Names
/* !! Important: if you change this names,                  !! *
 * !!    please do remove/rename collections in db MANUALLY !! */
var devicelistDB_name = "devices"; // list of devices
var deviceDB_prefix = "device_"; // prefix of device id
var tmpDB_prefix = "tmp_"; // prefix of temporary collection

  // --- Mongoose Schemas --- //
// Schema to store the device properties

// TODO: es wäre besser, wenn die Keys fürs DeviceSchema aus der Config bestimmt werden (unnamedTypes)

var DeviceSchema = new Schema(
  {
  _id        : String, // index = Measuring Device ID
  roomNr     : String, // Room Number
  room       : String, // Room Type
  kind       : String, // What is measured
  method     : String, // Type of Measure
  threshold  : Schema.Types.Object, // Thresholds: {'from':null,'to':null}
  isBoolean  : Boolean, // true if Measure is boolean
  unit       : String, // Measuring units
  storage    : String  // Name of the Collection with Device values
  },
  // options
  { // significant performance improvement
  // autoindex: false // http://mongoosejs.com/docs/guide.html
//TODO check if index is registered and register it manually and set 'autoindex: false'
  }
);

// Schema to store the values
// created through the function because of dynamic storage_size
// storage size need to be given in Megabytes
var StorageSchema = function( storage_size ){
  // it's only for privately use,
  // so correctness storage_size is a pre-condition
  return new Schema(
    {
    _id     : Number, // index = x.getTime()
    x       : Date, // Time of Measure
    y       : Number, // Measured Value
    exceeds : Boolean // false = under the limit,
                      // true = over the limit,
                      // null = ok.
    },
    // options
    {
    // Define fixed size in bytes
    //   autoindexId: false - shuts off the indexing by _id
    capped: { size: 1024*1024 * storage_size },
    // Versioning (__v) is important for updates.
    // No updates => versioning is useless
    versionKey: false // gets versioning off

    //, autoindex: false // significant performance improvement
//TODO check if index is registered and register it manually and set 'autoindex: false'
    }
  );
};

// default parameters for database connection
var default_db_options = {
    ip     : "localhost",  // Default IP-Address of MongoDB Database
    port   : 27017,        // Default Port of MongoDB Database
    name   : "default"     // Name of default MongoDB Database
};

  // --- Constructor --- //
//TODO describe database_options and what constructor actually do
var DeviceModel = function(){

  // Ensure the constructor was called correctly with 'new'
  if( !(this instanceof DeviceModel) )
    return new DeviceModel(database_options, callback);

  // --- Local Variables --- //

  // maximal limit of values to query (by one request)
  this.max_query_limit = 5000;
  // default size in Megabytes for values collections per device
  this.default_storage_size = 50;
  // true if identical values need to be saved, false if not
  this.save_identical_values = true;


  this.TmpModel; //local instance of TmpModel

  // tmpDB helpful variables
  this.cur_tmp = 0; // index of current temporary collection
//TODO write a function, that defines if there is need for more tmp collections
  this.num_of_tmps = 3; // number of temporary collections
  this.tmpDB; // temporary collection
  this.tmpIsInUse = false; // true if new data is been currently written to tmpDB
  this.tmp_switch_callback; // temporary callback pointer

  // local StorageSchema
  this.StorageSchema = StorageSchema(this.default_storage_size);

// TODO test if model properly created without establishing connection!!!
// TODO set error handling by every early access to the model!
  this.database = mongoose.createConnection(); // connection to the database (not yet established)

  // Essential variable: the device model
  this.model = this.database.model(devicelistDB_name, DeviceSchema);
};

// Make it possible to emit Events
DeviceModel.prototype = new EventEmitter;

  // --- Functions --- //

// private function to extend the standard error with important data.
function extendError(error, model){
  error.dbindex = model.index;
  error.dbname = model.database_name;
  return error;
}

// TODO describe the function
DeviceModel.prototype.createConnection = function(database_options){

  // if there are no database_options, we can use default options
  if( database_options == undefined ) database_options = {};

  // Fill undefined options with default ones
  _.defaults(database_options, default_db_options);
  if(database_options.index === undefined) // default index is a current db-name
    database_options.index = database_options.name;

  //--- Set Local Variables --- //

  this.connection_options = {
      ip     : database_options.ip,
      port   : database_options.port,
      name   : database_options.name
  }

  this.index = database_options.index; // own index to sign the emitted events
  this.database_name = database_options.name; // name of the database

  //set local TmpModel
  this.TmpModel = new TmpModel(this.model, this.index);

  //set current temporary collection
  this.tmpDB = this.database.model(tmpDB_prefix+this.cur_tmp, this.TmpModel.schema);

  var self=this;

  // Check if there are options to set before the start and set it if needed
  // Also connect to the db and call the callback
  this.setDefaults(database_options, function(err, index){
    if(err) {
      err.forEach(function(error){
        self.emit('error', extendError(error, self));
      })
    }
  });
};

DeviceModel.prototype.connect = function(callback){
  var self=this;
//DB Events forwarding
  self.database.on('error',
      function(err) { self.emit('error', extendError(err, self)); }
  );
  // Establish the connection to DB.
  self.database.open(self.connection_options.ip, self.connection_options.name,
                      self.connection_options.port,
                      function(err){
                        if(callback) callback(err, self.index);
                      }
  );
};

// TODO description
DeviceModel.prototype.disconnect = function(callback){
// TODO test it
  if(this.database.readyState!=0) this.database.close(callback);
  // else: already disconnected
};

/*
 * Sets new default values to the Model from options-Object
 * Possible properties to change:
 *   index : custom index for this model (leave this to your care)
 *   max_query_limit : maximal limit of values to query (by one request)
 *   default_storage_size : default fixed size in Megabytes
 *                          for collection of values per device.
 *                          It will be used only by creation of new device
 *
 *   save_identical_values : true if identical values need to be saved
 *                           false if not
 *                           it also indicates if client needs to receive
 *                           the identical values
 *
 * e.g.: options = { max_query_limit = 10000 };
 *
 * callback passes back an error-array, if there are any problems
 *   or nothing if nothing goes wrong.
 *
 * !!WARNING!! The model is preinitilized with default values, so
 *             if there is any option wrong or empty,
 *             this option wont be changed
 *
 */
DeviceModel.prototype.setDefaults = function(options, callback){
  if(options == undefined) return callback(null, this.index);

  var errors = [];

  if(options.max_query_limit != undefined){
    if(!_.isNumber(options.max_query_limit)){
      errors.push(new Error("max_query_limit is not a Number!\n" +
                             JSON.stringify(options.max_query_limit)));
    } else if (options.max_query_limit <= 0) {
      errors.push(new Error("max_query_limit need to be positive!\n" +
                             options.max_query_limit));
    } else {
      this.max_query_limit = options.max_query_limit;
    }
  }

  if(options.default_storage_size != undefined){
    if(!_.isNumber(options.default_storage_size)){
      errors.push(new Error("default_storage_size is not a Number!\n" +
                             JSON.stringify(options.default_storage_size)));
    } else if (options.default_storage_size <= 0) {
      errors.push(new Error("default_storage_size need to be positive!\n" +
                              options.default_storage_size));
    } else {
      this.default_storage_size = options.default_storage_size;
      this.StorageSchema = StorageSchema(this.default_storage_size);
    }
  }

  if(options.save_identical_values != undefined){
    if(!_.isBoolean(options.save_identical_values)){
      errors.push(new Error("save_identical_values is not a Boolean!" +
                             JSON.stringify(options.save_identical_values)));
    } else {
      this.save_identical_values = options.save_identical_values;
    }
  }

  if(errors.length < 1) return callback(null, this.index);
  else return callback(errors, this.index);
};

  //--- DeviceSchema Functions --- //
/*
* Switches temporary Database to the next one
* and passes the current one per callback
*/
DeviceModel.prototype.switchTmpDB = function(callback){
  var last_tmpDB = this.tmpDB;
  // Current state: "this.tmpDB == last_tmpDB" is true
  this.cur_tmp = (this.cur_tmp + 1) % this.num_of_tmps;
  // switch the temporary Database
  this.tmpDB = this.database.model('tmp_'+this.cur_tmp, this.TmpModel.schema);
  // Current state: "this.tmpDB == last_tmpDB" is false
  if(callback){
   // if there are any write operations on tmpDB,
   //    the callback needs to be called after the end of that operations!
   if(this.tmpIsInUse) this.tmp_switch_callback = callback;
   // but if tmpDB isn't currently in use, the callback can be called now
   else callback(last_tmpDB, this.index);
  }
};

//Creates or updates list of devices in database using given array "devices"
DeviceModel.prototype.setDevices = function(devices, callback){
//TODO do a test with undefined devices
  if(!_.isArray(devices)) devices = [devices];

  devices.filter( function(item){ return item } ); //filter out empty devices

  var self = this;
  async.each(devices,
     function(device, async_callback){
       self.model.update( {'_id':device.id}, device, { upsert: true },
           function(err) {
            if (err) {
              console.warn("device '" + device.id + "' can't be written to the list!");
              async_callback(extendError(err, self));
              return;
            }
            async_callback();
          }
       );
     },
     function(errors){
       if(callback) callback(errors, self.index);
     }
  )
};

/*
* Append new values to the Database depending on device IDs
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
DeviceModel.prototype.append = function (newData, callback) {
  if(newData === undefined) { // just remove this Error, if you don't need it
    if(callback) return callback(new Error("'newData' is undefined!"), null, this.index);
    return;
  }
  var self = this; // allow to pass this model to other functions

  // preparations, because of time-based switch of temporary collections
  this.tmpIsInUse = true;
  var curr_tmpDB = this.tmpDB;
  if(curr_tmpDB === undefined) console.log(curr_tmpDB);
  // Ensure, that newData is array
  if(!_.isArray(newData)) newData = [newData];

  // Append all data from the array to database in parallel
  // and pack all data returned from save() to one array to pass it to callback
  async.map(
   newData,
   function(data, async_callback) {
     if(data === undefined) return;

     save(self, data, function(err, result){
       if( result == undefined || result.values.length<1 )
         return async_callback(err);
       // fill the temporary model with data from current update
       self.TmpModel.appendToModel(curr_tmpDB, result, function(err){
         if(err) extendError(err, self);
         async_callback(err, result);
       });
     })
   },
   function(errors, appendedData){
     // curr_tmpDB is no longer in use
     self.tmpIsInUse = false;
     if(self.tmp_switch_callback && curr_tmpDB != self.tmpDB){
       // "curr_tmpDB != self.tmpDB" checks if self.tmpDB was switched
       self.tmp_switch_callback(curr_tmpDB, self.index);
       // Prevent double call of tmp_switch_callback
       self.tmp_switch_callback = null;
     }

     // Pass appendedData to the callback if it's needed
     if(callback) {
       // Remove all empty elements from appendedData
       appendedData = appendedData.filter(function(n){ return n });

       callback(errors, (appendedData.length>0)?appendedData:null, self.index);
     }
   }
  );
};

/* Private function - append()'s helper */
// Saves the data to the given instance of DeviceModel
// !! precondition: need newData.id to arrange the values !!
function save(self, newData, callback){

  // Private function -> preconditions needs to be filled
  // if(newData.id === undefined) return;


  // If there're no values, can be that the function was called to check the device
  if(newData.values == undefined) newData.values = {};

  // Open collection of values or create a new one
  self.model.findOne({'_id':newData.id},
   function(err, result){
     if(err){
       console.warn("Some DB Error by search for device '"+newData.id+"'!");
       if(callback) return callback(extendError(err, self));
       return;
     }

     var storage;
     if(result && result.storage){ // the device is in the list and have .storage
       storage = self.database.model(result.storage, self.StorageSchema);
     } else { // write device to the list
       // create new collection of values and save it by device description
       // collection names are always lower case

       // Mögliche Fehlerquelle, falls nicht alle ids gesetzt sind
       var storagename = (deviceDB_prefix + newData.id).toLowerCase();
       self.model.update({'_id':newData.id},
           { $set: { 'storage': storagename }},
           { upsert: true },
          function(err) {
           if (err) {
//TODO better handle the error!
             console.warn("storagename can't be appended to device '"+newData.id+"'!");
             console.warn(err.stack);
           }
         }
       );
       storage = self.database.model(storagename, self.StorageSchema);
     }

     if(_.isEmpty(newData.values)){
       callback(null, null);
     } else {
       // set custom _id for each value and save changed array to new variable
       var valuesToAppend = _.map(
         newData.values,
         function(item){
           // set time as current value _id
           item._id = item.x.getTime();
           return item;
         }
       );

//TODO stress test (lot of devices and values parallel)

       // append_new_values serves to properly writing
       //    of possible values with identical time
       // append_tries = count of writing tries for problem values
       var append_new_values = function(newValue, append_tries, done){
         // We always create new mongoDB Document for every value!
         storage.create( newValue,
           function(err) {
             if (err) {
               // '11000' is a duplicate _id error
               if(err.code == 11000 && append_tries < 1000){
                 // make sure it's a duplicate
                 storage.findById(newValue._id, function (err, result) {
                   if(err){
//TODO better handle the error!!
                     console.warn("Error by searching for value: '"+newValue._id+"'!");
                     return done();
                   }

                   // if values are same, and same values don't need
                   // to be written to db, then we're done with that value
                   if(!(self.save_identical_values) && result.y === newValue.y)
                     return done();

                   // increase _id on 0.001
                   newValue._id = newValue._id+=0.001;

                   // try again
                   append_tries++;
                   return append_new_values(newValue, append_tries, done);
                 });
                 return;
               }
               // error is not '11000' or append_tries is over the limit
               return done(extendError(err, self));
             }
             // no errors
             delete newValue._id; // we don't need _id anymore
             return done( null, newValue );
           }
         );
       }

       // append all values to database in parallel
       async.map(
           valuesToAppend,
           // function to append
           function(value, async_callback){
             // 0, because it's a first try to append the value
             append_new_values(value, 0, async_callback);
           },
           // 'appendedValues' is an array of all values,
           //    that were passed to async_callback. Same with 'errors'.
           function(errors, appendedValues){
             if(errors){
               if(callback) return callback(err, appendedValues);
               else return;
             }

             callback( null,
               { id     : newData.id,
                 values : appendedValues. // values, that were appended
                         // remove 'undefined' values
                         filter(function(item){ return item })
               }
             );
           }
       );
     }
   }
  );
};

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
*              ! Note: 'from' means '>=', 'to' means '<'
*              !       just 'time' means '=='
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
DeviceModel.prototype.query = function (search_pattern, callback) {
  var self = this;
  if(search_pattern === undefined) search_pattern = {}; // no request means 'request everything'
  if(_.isFunction(search_pattern)){
    // may be the first argument is a callback
    callback = search_pattern;
    search_pattern = {};
  } else if( callback === undefined || !_.isFunction(callback) ) {
     // query is useless without a callback!
     throw new Error("Database query without a callback!");
  }

  if(!_.isArray(search_pattern)){
    return find(self, search_pattern, callback);
  }

  async.map(search_pattern, function(query, async_callback) {
    find(self, query, async_callback);
  }, function(err, result){
    for(var i in result){
      result[i]=result[i][0];
    }
    callback(err, result);
  });
};

/* Private function - query()'s helper */
function find(self, request, callback) {
  var time; // check and parse the requested time
  if(request.time !== undefined) {
    if(request.time.from !== undefined || request.time.to !== undefined){
      if(request.time.from){
        try {
          time = {};
          // '$gte' is 'Greater Than or Equal'
          time['$gte'] = new Date(request.time.from).getTime();
        } catch (e) {
          return callback(new Error('requested time.from is wrong!\n'+
                          JSON.stringify(request.time.from)), null, self.index);
        }
      }
      if(request.time.to){
        try {
          if(!time) time = {};
          // '$lt' is 'Less Than'
          time['$lt'] = new Date(request.time.to).getTime();
        } catch (e) {
          return callback(new Error('requested time.to is wrong!\n'+
                          JSON.stringify(request.time.to)), null, self.index);
        }
      }
    } else { // no 'time.from' and no 'time.to'
      try {
        time = new Date(request.time).getTime();
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

  // at first search for required devices
  self.model.find(device_query, function(err, devices) {
   if(err){
     return callback(extendError(err, self), null, self.index);
   }
   if(devices.length == 0) return callback(null, null, self.index);

   // set temporary max_query_limit to check the requested limit
   var limit = self.max_query_limit/devices.length;
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
   limit|=limit; // parse to integer without rounding up

   // do a parallel search for values of every requested device
   //   and pack all results in one array
   async.map(
     devices,
     // searching function
     function(device, async_callback){
       // query collection with values for current device
       var values_collection = self.database.model(device.storage, self.StorageSchema);

       var query;

       // do a search
       if(time !== undefined){
         query = values_collection.find({ '_id': time });
       } else {
         query = values_collection.find({});
       }

       // limit the query
       // The $natural parameter returns items according to their natural
       //   order within the database. It's the fastest order to sort.
       if( limit < 0 ){
// TODO try query.skip(values_collection.count() - limit);
         query.sort({ $natural:-1 })
              .limit(-limit);
         // sadly, mongodb-query can't sort once again after the '.limit' option
         // and also mongodb can't limit to the last values...
       } else {
         query.sort({ $natural:1 })
              .limit(limit);
       }
       query.select('-_id -__v'); // exclude '_id' & '__v'

       query.exec(function(err, results){
         if(err) return done(extendError(err, self));

         if( limit < 0 ) {
           // by the limit < 0, values were presorted in descending order
           // so we do the ascending sort manually
           results= _.sortBy(results, function(obj){ return obj.x; });
         }


         async_callback(null, {'id':device.id, 'values': results});
       });
     },
     // 'result' is an array of all the results. Same way with 'errors'.
     function(errors, result) {
       // send all queried results from requested devices as one array back
       callback(errors, result, self.index);
     }
   );
  });
};

/*
* Change size of existing Storage-Collection
* !!              WARNING: it blocks all the db operations              !!
* !! needed amount of time depends on current number of stored elements !!
* Arguments:
*    id = id of device
*    size = new size in Megabytes, that need to be set ( greater than 0 )
*    callback = calls a function(err) at the end
*/
DeviceModel.prototype.resizeStorage = function (id, size, callback) {
  var self=this;
  if(id==undefined){
    if(callback) return callback(new Error("id needs to be defined"), self.index);
    return;
  }
  if(size==undefined || size <= 0){
    if(callback) return callback(new Error("Wrong storage size: "+size), self.index);
    return;
  }

  this.model.findOne({'_id':id},
     function(err, result){
       if(err){
         console.warn("Some DB Error by searching for device '"+id+"'!");
         if(callback) return callback(extendError(err, self), self.index);
         return;
       }
       if(!result){ // id wasn't found
         if(callback)
           return callback(new Error("Device '"+id+"' wasn't found!"), self.index);
         return;
       }
       if(result.storage == undefined){ // id wasn't found
         if(callback)
           return callback(new Error("There is no storage for device '"+id+"'!"), self.index);
         return;
       }

       // call the db command to resize a collection
// TODO test it!!!
       self.database.command(
           { convertToCapped: result.storage, size: size*1024*1024 },
           function(err){
             if(err){
               console.warn("Cannot resize given collection!\n" +
                             result.storage);
               if(callback) return callback(extendError(err, self), self.index);
               return;
             }
             console.log("storage '"+result.storage+"' was resized to "+size+" Mb.");
           }
       );
     }
  );
};

//TODO description
DeviceModel.prototype.resizeAll = function (size, callback) {
  var self = this;
  //at first search for all existing devices
  self.model.find({}, function(err, devices) {
    if(err){
      if(callback) return callback([extendError(err, self)], self.index);
      return;
    }
    if(devices.length == 0){
      if(callback) return callback(null, self.index);
      return;
    }
    async.map(
        devices,
        // searching function
        function(device, async_callback){
          self.resizeStorage(device._id, size, async_callback);
        },
        function(indexes, errors) {
          callback(errors, self.index);
        }
    );
  });
};

module.exports = DeviceModel;
