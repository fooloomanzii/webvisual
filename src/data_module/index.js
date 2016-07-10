'use strict';

var ioServer = require('socket.io'),
  EventEmitter = require('events').EventEmitter,
  // custom: DATAMODULE
  filehandler = require('./filehandler'),
  // custom: mailer
  // mailer = new require('./mail')('exceeds'),

  /* Class variables */
  Settings = require('./settings'),
  dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
  mergeData = filehandler.dataMerge; // extension: of DATAMODULE

class dataModule extends EventEmitter {

  constructor(server, config) {
    super();
    this.configHandler = new Settings();
    this.io = new ioServer();
    this.dataSocket = this.io.of('/data');

    this.currentData = {};
    this.dataFile = {};

    if(server)
      this.setServer(server);
    if(config)
      this.connect(config);
  }

  setServer(server) {
    this.io.listen(server);
  }

  connect(config) {
    this.configHandler.watch(config);

    this.configHandler.on('ready', (function(name) {
      this.emit('change', this.configHandler.settings[name].configuration, name);

      if (!this.currentData[name])
        this.currentData[name] = {};

      if (!this.dataFile[name])
        this.dataFile[name] = {};

      // dataFileHandler - established the data connections

      for (let label of this.configHandler.settings[name].configuration.labels) {

        let listeners = {
          error: (function(type, err, label) {
            // dataSocket.emit('mistake', { error: err, time: new Date() });
            this.handleErrors(err, "dataFileHandler id: " + label);
          }).bind(this),
          data: (function(type, data, label) {
            if (!data || data.length == 0)
              return; // Don't handle empty data
            // temporary save data
            if (this.configHandler.settings[name].dataConfig[label]) {
              // process data
              let mergedData = mergeData(this.configHandler.settings[name].dataConfig[label], data);
              // serve clients in rooms for labels
              // only newer data is send
              // TODO: handle this optional by config
              if (this.currentData[name][label] && mergedData.date > this.currentData[name][label].date) {
                this.dataSocket.to(name + '__' + label).emit("update", mergedData);
              }
              this.currentData[name][label] = mergedData;
            }
          }).bind(this)
        };

        if (this.dataFile[name][label]) {
          this.dataFile[name][label].close();
          // delete dataFile[name][label];
        }

        this.dataFile[name][label] = new dataFileHandler({
          id: label,
          connection: this.configHandler.settings[name].connection[label],
          listener: listeners
        });

        this.dataFile[name][label].connect();
      }

      // Handle connections of new clients
      this.dataSocket.on('connection', (function(socket) {

        var name = socket.handshake.query.name;
        // console.log(socket.handshake.query);

        socket.emit('init', this.configHandler.settings[name].configuration);

        socket.on('init', (function(config) {
          for (var label of config.labels) {
            socket.join(name + '__' + label); // client joins room for selected label
            socket.emit('update', this.currentData[name][label]);
          }
        }).bind(this));

        // socket.on('disconnect', function() {
        //   // leave rooms on disconnect
        //   var rooms = io.sockets.manager.roomClients[socket.id];
        //   for (var room in rooms) {
        //     socket.leave(room);
        //   }
        // });
      }).bind(this));

      this.io.of('/data').clients(function(error, clients) {
        if (error) {
          throw error;
          console.log('data-socket clients error', clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
        }
      });
    }).bind(this))
  }

  disconnect() {
    for (var name in this.dataFile) {
      for (var label in this.dataFile[name]) {
        this.dataFile[name][label].close();
        delete this.dataFile[name][label];
      }
    }
    this.io = null;
    this.dataFile = {};
  }

  // private function to handle the errors
  handleErrors(errors, id_message) {
    console.log("error");
    if (errors === undefined)
      return;
    if (Array.isArray(errors)) {
      errors.forEach(function(err) {
        handleErrors(err, id_message)
      });
      return;
    }
    if (id_message === undefined)
      id_message = "";
    else
      id_message += ": ";
    // similar to JSON.stringify(), but shows more information
    var output = id_message + require('util').inspect(errors) + "\n";
    if (errors.stack !== undefined)
      output += errors.stack + "\n";
    console.warn(output);
  }

  // function initMailer(config) {
  //   /*
  //    * Init mailer
  //    */
  //   mailer.init({
  //     from: config.from, // sender address
  //     to: config.to, // list of receivers
  //     subject: config.subject
  //   });
  //   mailer.setType('html');
  //   mailer.setDelay(1000);
  // }
}

// Module exports
module.exports = dataModule;
