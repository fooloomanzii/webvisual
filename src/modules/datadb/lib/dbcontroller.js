var DataController = function (dataDB, logger) {

    this.crypto = require('crypto');
    this.uuid = require('node-uuid');
    this.ApiResponse = require('./api-response.js');
    this.ApiMessages = require('./api-messages.js');
    this.datamodel = require('./datamodel.js');
    this.dataDB = dataDB;
    this.logger = logger;
    
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