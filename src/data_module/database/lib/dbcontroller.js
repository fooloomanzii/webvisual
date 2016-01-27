/**  TODO's and description
 * // TODO make a more understandable error handling!
 * 
 * Short description
 * Controls all operations over the database within defined DB-Models
 * Can actually check some pre-conditions of the DeviceModel/TmpModel functions.
 * 
 * To use it, at first you need to set Listener for 'error'-event.
 * Then create connections to every database you need.
 * After that you can call the 'connect(index, callback)' function 
 * for every database.
 * 
 * Example:
 *   dbController.on( 'error', function (err) { console.warn(err) });
 *   dbController.createConnection(config.database, 1, function(db_index){
 *     dbController.connect(db_index, function (err, db_index2) { } );
 *   });
 *  
 * To know how every function works, please read the corresponding description.
 */

  // --- Node.js Module dependencies --- //
var mongoose     = require('mongoose'),
    EventEmitter = require('events').EventEmitter,
    _            = require('underscore');

  // --- Custom dependencies --- //
var DeviceModel = require('./devicemodel.js');

  //--- Constructor --- //
var DBController = function() {
  // Ensure the constructor was called correctly with 'new'
  if( !(this instanceof DBController) ) return new DBController();
  
  // -- Local Variables -- //
  this.deviceModels = []; // current database connections
}

// Make it possible to emit Events
DBController.prototype = new EventEmitter;

  // --- Local Functions --- //

// Checks if database with given 'index' was registered trough createConnection()
DBController.prototype.checkIndex = function(index){
  if(this.deviceModels[index] !== undefined) return true;
  this.emit('error', new Error("DeviceModel with index '"+ index +"' doesn't exists!!"));
  return false;
}

/* Register new Database for this Controller, 
 * so you can later connect to it with connect-function. 
 * Refer about possible options to DeviceModel.prototype.createConnection 
 * Important option is the name of the database to connect to.
 *   The function throws Error if no 'options' was passed to it.
 *   Another Error will be thrown if database name is not given.
 *    The name can be stored either under 'options.name '
 *    or 'options' can be a String with the name 
 *      (In case, you don't need any further options to set).
 *      
 * for other possible options please refer to devicemodel.js/DeviceModel.prototype.createConnection
 *      
 * index is an identifier for the database, 
 *   and is important for callbacks, to know from which database they come.
 *   It can be Object of any kind you want (Number, String, Boolean, Object,..)
 *   
 * callback: function(model_index)
 *      model_index: index of created model
 * */
DBController.prototype.createConnection = function(options, index, callback){

  if(options === undefined){
    throw new Error("'options' needs to be submitted!!");
  }  
  if(options.name === undefined){
    if(_.isString(options) ) options = {name: options};
    else throw new Error("database name needs to be defined!!");
  } 
  
  var self=this;
  
  // check the index
  if(index !== undefined) options.index = index;
  else options.index = options.name; // default index is a current db-name
  
  // check if model with that index exists
  if(this.deviceModels[options.index] !== undefined)
    throw new Error("DeviceModel with index '"+ options.index +
        "' is already defined!!\nBy replacing, remove the old model first!");
  
  // Create new DeviceModel, Initialize database and set the options if needed
  // Append the model to the global array, so it can be controlled later
  this.deviceModels[options.index] = new DeviceModel(options, callback);
}

/*
 * Connect to database with given 'index'.
 * callback = function (error, db_index)
 *     error = possible error caused by establishing of database connection 
 *     db_index = corresponding database index
 */
DBController.prototype.connect = function(index, callback){
  if(!this.checkIndex(index)) return;
  
  // Events forwarding
  var self = this;
  this.deviceModels[index].on('error', function(err) { self.emit('error', err); });
  
  // Establish the connection to the model
  this.deviceModels[index].connect(callback);
};

/* Disconnect from any single database or from whole mongoose!!
 * CAREFUL! If no index is given, whole mongodb will be disconnected!!
 * 
 * callback = function (error, db_index)
 *     error = possible error caused by disconnecting of database 
 *     db_index = corresponding database index
 */
DBController.prototype.disconnect = function(index, callback){
  if(callback === undefined && (_.isFunction(index) || index === undefined)){
    mongoose.disconnect(index);
    return;
  }
  if(!this.checkIndex(index)) return;
  this.deviceModels[index].disconnect(callback);
};

/* Disconnect from all databases .
 * ! Makes sense to use, if there are other dbcontrollers, 
 * !   that don't need to be disconnected.
 * ! If you just need to fully disconnect from mongoose, use mongoose function instead.
 * 
 * callback = function (model_indexes)
 *     model_indexes = indexes of successfully disconnected databases
 */
DBController.prototype.close = function(){
  var self = this;
  async.map(this.deviceModels, 
      function(model, async_callback){
        
        // Disconnect from every database
        model.disconnect(function(model_index){ 
          async_callback(null, model_index); 
        });
      },
      function(err, results){
        if(err) self.emit('error', err);
        callback(results);
      }
  );
};

/*
 * Remove Model from Controller and make the corresponding 'index' free.
 * If no 'index' is given, removes all databases from this Controller.
 * 
 * index: index of the database to be removed, set by createConnection()
 * callback: function (db_index)
 *           db_index: given 'index'
 */
DBController.prototype.remove = function(index, callback){
  if(index !== undefined) delete this.deviceModels[index];
  else this.deviceModels.length = 0; //clear the list
};

/*
 * Create or update list of devices in database using given array "devices"
 * 
 * index: index of the database to set the devices, set by createConnection()
 * devices: array with devices. each 'device' needs to have an id
 *          e.g. {id: 'device1', type: 'computer'}
 *          every property you set, can be used in the query function
 * callback: function(model_index)
 *           model_index: index of database, the devices were set
 */ 
DBController.prototype.setDevices = function (index, devices, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  // set devices to the corresponding model
  this.deviceModels[index].setDevices(devices, function(model_index){
    if(callback) callback(model_index);
  });
};

/*
 * Appends data to Database.
 * Data should look like schema of the dataModel.
 * Calls the callback with possible error and success response
 * 
 * index:    index of the database to append the data, set by createConnection()
 * newData:  can be one Object or Array of Objects
 * callback: function(appendedData, model_index);
 *           appendedData: data, that was appended to the database
 *           model_index: index of database, the data was appended
 */
DBController.prototype.appendData = function (index, newData, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  // append data to the corresponding database
  this.deviceModels[index].append(newData, function(appendedData, model_index){
    if(callback) callback(appendedData, model_index);
  });
};

/*
 * Search for some query and call the callback with found data
 * 
 * index: index of the database to query, set by createConnection()
 * search_pattern: the search-object. Please read the exact description by devicemodel.js/DeviceModel.prototype.query()
 * callback: function(result, model_index);
 *           result: data, found using the search_pattern
 *           model_index: index of database, the data was queried
 */
DBController.prototype.getData = function (index, search_pattern, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  // query data from the corresponding database
  this.deviceModels[index].query(search_pattern, function (result, model_index) {
    if(callback) callback(result, model_index);
  });
};

/*
 * Set new fixed size in Megabytes to values storage for given device in given model
 * 
 * index: index of the database that includes the device to change the size.
 *        The index need to be set by createConnection()
 * id: id of the device, to change the size of values storage to
 * newSize: new fixed size in Megabytes for the values storage of only the given device
 * callback: function(model_index)
 *           model_index: index of database with device, storage size was changed
 */
DBController.prototype.resize = function (index, id, newSize, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  this.deviceModels[index].resizeStorage(id, newSize, function (model_index) {
    if(callback) callback(model_index);
  });
};

/*
 * Sets new fixed size in Megabytes to collections of values for all devices in given model
 * 
 * index: index of the database that includes the devices to change the size.
 *        The index need to be set by createConnection()
 * newSize: new fixed size in Megabytes for the values storage of all devices of given model
 * callback: function(model_index)
 *           model_index: index of database with device, storage size was changed
 */
DBController.prototype.resizeAllInModel = function (index, newSize, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  this.deviceModels[index].resizeAll(newSize, function (model_index) {
    if(callback) callback(model_index);
  });
};

/*
 * Sets new fixed size in Megabytes to collections of values for all devices of all connected databases
 * 
 * newSize: new fixed size in Megabytes for the values storage of all devices of all connected databases
 * callback: function() without parameters, you need to call at the end of all operations
 */
DBController.prototype.resizeAll = function (newSize, callback) {
  var self=this;
  async.forEachOf(this.deviceModels, 
      function(model, index, async_callback){
        self.resizeAllInModel(index, newSize, async_callback)
      },
      function(err){
        if(err)  self.emit('error', err);
        callback();
      }
  );
};


/*
 * Search for some query in temporary database and call the callback with found data
 *   temporary database is the database, that includes only the data, since last tmpDB switch
 * index: index of the model corresponding to the temporary database
 *        The index need to be set by createConnection()
 * tmpDB: reference to the temporary database, that needs to be queried
 *        you can become the reference from DBController.prototype.switchTmpDB()
 * search_pattern: the search-object. Please read the exact description by tmpmodel.js/TmpModel.prototype.queryFromModel()
 * callback: function(result, model_index)
 *           result: data, found using the search_pattern
 *           model_index: index of database, the data was queried
 */
DBController.prototype.getDataFromTmpModel = function (index, tmpDB, search_pattern, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  this.deviceModels[index].TmpModel.queryFromModel(tmpDB, search_pattern, function (err, result, model_index) {
    if(err) self.emit('error', extendError(err, self));
    if(callback) callback(result, model_index);
  });
};

/*
 * Switches Temporary Database to the next one and passes the current one per callback
 * index: index of the model corresponding to the temporary database
 *        The index need to be set by createConnection()
 * callback: function(tmpDB, model_index)
 *           tmpDB: reference to the temporary database
 *                  needs to be used by DBController.prototype.getDataFromTmpModel
 *           model_index: index of database, the data was queried
 */
DBController.prototype.switchTmpDB = function (index, callback) {
  if(!this.checkIndex(index)) return;
  var self=this;
  this.deviceModels[index].switchTmpDB(function(tmpDB, model_index){
    callback(tmpDB, model_index);
  });
};

// --- Exports --- //
module.exports = DBController;