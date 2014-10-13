(function(){
'use strict';

var nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    _ = require('underscore');
    //emailRegex = '/^[a-z][a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$/i'

var MailHelper = (function() {
  var defaults={
        from: 'SCADA <webvisual.test@gmail.com>', // sender address
        subject: 'Node.js Mail', // Subject line
      },
      delay = 1*60*1000, //delay in milliseconds
      options,
      type='text',
      transporter = nodemailer.createTransport(smtpTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'webvisual.test@gmail.com',
            pass: '148148148'
        }
      }));

  //Constructor
  function _Class(config) {
    // Ensure the constructor was called correctly with 'new'
    if( !(this instanceof _Class) ) return new _Class(config);
    
    this.init(config);
  }
  
  // Re-/Initialize object with new options
  _Class.prototype.init = function(config) {
    // The threshhold value
    if(config) options = _.defaults(config,defaults);
    else options = defaults;
  };
  
  // ptype: 'html' or 'text' for HTML <-> Plain Text Mesages
  _Class.prototype.setType = function(ptype) {
    type=ptype;
  };
 
  /* Send a message
   * msg: Not empty String
   * type: 'html'/'text'
   * callback(err,info): function to handle the response
   */
  _Class.prototype.sendMsg = function(msg, type, callback){
    var cb;
    if(callback && typeof(callback) == 'function'){
      if(!msg){
        callback('Empty Message!', null);
        return;
      }
      cb=callback;
    }
    if(type){
      if(type === 'html'||type === 'text')
        options[type]=msg;
      else if(typeof(type) == 'function'){
        if(!msg){
          type('Empty Message!', null);
          return;
        }
        options.text=msg;
        cb=type;
      }
    } else {
      options.text=msg;
    }
    if(!msg) return;
    transporter.sendMail(options, cb);
  }
  
  // Send a message of Plain Text Type 
  _Class.prototype.sendText = function(msg, callback) {
    if(!msg){
      if(callback) callback('Empty Message!', null);
      return;
    }
    options.text=msg;
    if((callback && typeof(callback) == 'function')){
      transporter.sendMail(options, callback);
    } else {
      transporter.sendMail(options);
    }    
  };
  
  //Send a message of HTML Type 
  _Class.prototype.sendHtml = function(msg, callback) {
    if(!msg){
      if(callback) callback('Empty Message!', null);
      return;
    }
    options.html=msg;
    if((callback && typeof(callback) == 'function')){
      transporter.sendMail(options, callback);
    } else {
      transporter.sendMail(options);
    }  
  };
  
  // Add an e-mail to the list of receivers (cannot be empty)
  _Class.prototype.addTo = function(to) {
    if(!to) return;
    if(options.to) options.to+=", ";
    options.to+=to;
  };
  
  // Set new list of receivers (cannot be empty)
  _Class.prototype.setTo = function(to) {
    if(!to) return;
    options.to=to;
  };
  
  // Set new subject
  _Class.prototype.setSubject = function(subj) {
    if(!subj) return;
    options.subject=subj;
  };
  
  // Set new transporter
  _Class.prototype.setTransporter = function(transp) {
    if(!transp) return;
    transporter=transp;
  };
  
  //make a MailHelper to a Class
  return _Class;
})();


// Module exports
module.exports = MailHelper;

})();