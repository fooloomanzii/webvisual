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
          
      if (numberAffected === 1) { // Success
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
          
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
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
  
  
  me.userModel.findOne({ id: newData.id }, function (err, user) {
    if (err) {
      return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.DB_ERROR } }));
    }
    
    if (user) {
      return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.EMAIL_ALREADY_EXISTS } }));
    } else {
    
      newUser.save(function (err, user, numberAffected) {
  
          if (err) {
              return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.DB_ERROR } }));
          }
              
          if (numberAffected === 1) {
  
              var userProfileModel = new me.UserProfileModel({
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName
              });
  
              return callback(err, new me.ApiResponse({
                  success: true, extras: {
                      userProfileModel: userProfileModel
                  }
              }));
          } else {
              return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.COULD_NOT_CREATE_USER } }));
          }             
  
      });
    }
  }
}

AccountController.prototype.register = function (newUser, callback) {
  var me = this;
  me.userModel.findOne({ email: newUser.email }, function (err, user) {

      if (err) {
          return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.DB_ERROR } }));
      }

      if (user) {
          return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.EMAIL_ALREADY_EXISTS } }));
      } else {

          newUser.save(function (err, user, numberAffected) {

              if (err) {
                  return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.DB_ERROR } }));
              }
                  
              if (numberAffected === 1) {

                  var userProfileModel = new me.UserProfileModel({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName
                  });

                  return callback(err, new me.ApiResponse({
                      success: true, extras: {
                          userProfileModel: userProfileModel
                      }
                  }));
              } else {
                  return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.COULD_NOT_CREATE_USER } }));
              }             

          });
      }

  });
};


DataController.prototype.logon = function(email, password, callback) {

  var me = this;

  me.userModel.findOne({ email: email }, function (err, user) {

      if (err) {
          return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.DB_ERROR } }));
      }

      if (user) {

          me.hashPassword(password, user.passwordSalt, function (err, passwordHash) {

              if (passwordHash == user.passwordHash) {

                  var userProfileModel = new me.UserProfileModel({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName
                  });

                  me.session.userProfileModel = userProfileModel;

                  return callback(err, new me.ApiResponse({
                      success: true, extras: {
                          userProfileModel:userProfileModel
                      }
                  }));
              } else {
                  return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.INVALID_PWD } }));
              }
          });
      } else {
          return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.EMAIL_NOT_FOUND } }));
      }

  });
};



DataController.prototype.logon = function(email, password, callback) {

  var me = this;

  me.userModel.findOne({ email: email }, function (err, user) {

      if (err) {
          return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.DB_ERROR } }));
      }

      if (user) {

          me.hashPassword(password, user.passwordSalt, function (err, passwordHash) {

              if (passwordHash == user.passwordHash) {

                  var userProfileModel = new me.UserProfileModel({
                      email: user.email,
                      firstName: user.firstName,
                      lastName: user.lastName
                  });

                  me.session.userProfileModel = userProfileModel;

                  return callback(err, new me.ApiResponse({
                      success: true, extras: {
                          userProfileModel:userProfileModel
                      }
                  }));
              } else {
                  return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.INVALID_PWD } }));
              }
          });
      } else {
          return callback(err, new me.ApiResponse({ success: false, extras: { msg: me.ApiMessages.EMAIL_NOT_FOUND } }));
      }

  });
};


module.exports = DataController;