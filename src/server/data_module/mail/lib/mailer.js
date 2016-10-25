(function() {
  'use strict';

  var nodemailer = require('nodemailer'),
      smtpTransport = require('nodemailer-smtp-transport'),
      directTransport = require('nodemailer-direct-transport'),
      _ = require('underscore'), fs = require('fs'),
      EventEmitter = require('events').EventEmitter;
  // emailRegex = '/^[a-z][a-z0-9._%+-]+@[a-z0-9.-]+.[a-z]{2,4}$/i'

  var MailHelper = (function() {
    var defaults =
            {
              from : 'SCADA <webvisual.test@gmail.com>', // sender address
              subject : 'Node.js Mail',                  // Subject line
            },
        logDir = '../logs/', currFileName = 'currMsg', lastFileName = 'lastMsg',
        fileExt = 'log';

    // initialize Object variables with default values
    _Class.prototype.delay = 5 * 60 * 1000; // delay in milliseconds
    _Class.prototype.type = 'text';
    _Class.prototype.shippList = {};
    _Class.prototype.transporter = nodemailer.createTransport(smtpTransport({
      host : 'smtp.gmail.com',
      port : 465,
      secure : true,
      auth : {user : 'webvisual.test@gmail.com', pass : '148148148'}
    }));

    // Configure Emitter
    _Class.prototype._emitter = new EventEmitter();

    _Class.prototype._emitter.on('appendMsg', function(message) {
      if (typeof(message.msg) == 'undefined')
        return;
      fs.appendFileSync(message.currFile, message.msg);
    });

    _Class.prototype._emitter.on('sendMsg', function(message) {
      if (!fs.existsSync(message.self.currFile))
        return message.cb(null, {response : "Nothing to Send."});

      var curr = new Date().getTime(), path = message.self.lastFile(curr),
          mailOptions = JSON.parse(JSON.stringify(message.self.options));
      fs.renameSync(message.self.currFile, path);
      fs.readFile(path, function(err, data) {
        if (err) {
          console.warn(err);
        }
        if (!data)
          return message.cb(null, {response : "Nothing to Send."});
        mailOptions[message.self.type] = data;
        message.self.transporter.sendMail(mailOptions, function(err, info) {
          if (err) {
            // TODO may be multiply tries to send this mail
          } else {
            fs.unlink(path, function(err) {
              if (err) {
                console.warn(err);
              }
              console.log('successfully deleted ' + path);
            });
          }
          message.cb(err, info);
        });
      });
    });

    // Constructor
    function _Class(id, config) {
      // Ensure the constructor was called correctly with 'new'
      if (!(this instanceof _Class))
        return new _Class(id, config);

      this.id = id;
      if (!fs.existsSync(logDir + this.id))
        fs.mkdirSync(logDir + this.id);
      this.currFile = logDir + this.id + '/' + currFileName + '.' + fileExt;
      this.lastFile = function(suff) {
        return logDir + this.id + '/' + lastFileName + '.' + suff + '.' +
               fileExt;
      };
      this.init(config);
    }

    // Re-/Initialize object with new options
    _Class.prototype.init = function(config) {
      // The threshhold value
      if (config)
        this.options = _.defaults(config, defaults);
      else
        this.options = defaults;
      // TODO do sth. if lastMsg exists
    };

    // Get id of current Object
    _Class.prototype.getId = function() { return this.id; };

    // ptype: 'html' or 'text' for HTML <-> Plain Text Mesages
    _Class.prototype.setType = function(type) {
      if (type === 'html' || type === 'text')
        this.type = type;
    };

    _Class.prototype.appendMsg = function(msg) {
      this._emitter.emit('appendMsg', {currFile : this.currFile, msg : msg});
    };

    /* Send a stored message
     * callback(err,info): function to handle the response
     */
    _Class.prototype.sendMsg = function(callback) {
      this._emitter.emit('sendMsg', {self : this, cb : callback});
    };

    _Class.prototype.setDelay = function(delay) {
      if (delay < 1000)
        return;
      this.delay = delay;
    };

    _Class.prototype.startDelayed = function(callback) {
      var self = this;
      setInterval(function() { self.sendMsg(callback); }, this.delay);
    };

    // Send a message of Plain Text Type
    _Class.prototype.sendText = function(msg, callback) {
      if (!msg) {
        if (callback)
          callback('Empty Message!', null);
        return;
      }
      this.options.text = msg;
      if ((callback && typeof(callback) == 'function')) {
        this.transporter.sendMail(options, callback);
      } else {
        this.transporter.sendMail(options);
      }
    };

    // Send a message of HTML Type
    _Class.prototype.sendHtml = function(msg, callback) {
      if (!msg) {
        if (callback)
          callback('Empty Message!', null);
        return;
      }
      options.html = msg;
      if ((callback && typeof(callback) == 'function')) {
        this.transporter.sendMail(options, callback);
      } else {
        tthis.ransporter.sendMail(options);
      }
    };

    // Add an e-mail to the list of receivers (cannot be empty)
    _Class.prototype.addTo = function(to) {
      if (!to)
        return;
      if (this.options.to)
        this.options.to += ", ";
      this.options.to += to;
    };

    // Set new list of receivers (cannot be empty)
    _Class.prototype.setTo = function(to) {
      if (!to)
        return;
      this.options.to = to;
    };

    // Set new subject
    _Class.prototype.setSubject = function(subj) {
      if (typeof(subj) == 'undefined')
        return;
      this.options.subject = subj;
    };

    // Set new transporter
    _Class.prototype.setTransporter = function(transporter) {
      if (!transporter)
        return;
      this.transporter = transporter;
    };

    // make a MailHelper to a Class
    return _Class;
  })();

  // Module exports
  module.exports = MailHelper;

})();
