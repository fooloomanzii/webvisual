var DataController = function (dataDB, logger) {

    this.crypto = require('crypto');
    this.uuid = require('node-uuid');
    this.ApiResponse = require('./api-response.js');
    this.ApiMessages = require('./api-messages.js');
    this.datamodel = require('./datamodel.js');
    this.dataDB = dataDB;
    this.logger = logger;
    
};

DataController.prototype.appendData = function (newData, callback) {
  var me = this;
  
  newData.save(function (err, user, numberAffected) {
      
      if (err) { // some DB Error
        return callback(err, new me.ApiResponse({ 
          success: false, 
          extras: { msg: me.ApiMessages.DB_ERROR } 
        }));
      }
          
      if (numberAffected === 1) { // Successful
        var datamodel = new me.datamodel({
          date = user.date,
          id = user.id,
          roomNr = user.roomNr,
          room = user.room,
          kind = user.kind,
          method = user.method,
          value = user.value,
          isBoolean = user.isBoolean,
          threshold = user.threshold,
          unit = user.unit
        });

        return callback(err, new me.ApiResponse({
            success: true, 
            extras: { datamodel: datamodel }
        }));
      } else { // Nothing appended
        return callback(err, new me.ApiResponse({ 
          success: false, 
          extras: { msg: me.ApiMessages.COULD_NOT_CREATE_USER } 
        }));
      }             
  
  });
}

DataController.prototype.getAllData = function (callback) {
  callback(this.datamodel.find().pretty());
}


module.exports = DataController;