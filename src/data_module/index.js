'use strict';

var ioServer = require('socket.io'),
  io,
  dataSocket,
  EventEmitter = require('events').EventEmitter,
  // custom: DATAMODULE
  filehandler = require('./filehandler'),
  // custom: mailer
  // mailer = new require('./mail')('exceeds'),

  /* Class variables */
  Settings = require('./settings'),
  configHandler,
  dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
  mergeData = filehandler.dataMerge, // extension: of DATAMODULE
  svgSources,

  // currentData temporary saved for the first sending (unnecessary with db requests)
  currentData = {},
  dataFile = {},
  configuration = {},
  connection = {},
  dataConfig = {};


class dataModule extends EventEmitter {

  constructor(server) {

    super();
    io = new ioServer();
    io.listen(server);
    dataSocket = io.of('/data');

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

  connect(config) {

    configHandler = new Settings(config);
    configHandler.on('ready', (function(name) {

      this.emit('change', configHandler.settings);

      if (!currentData[name])
        currentData[name] = {};

      if (!dataFile[name])
        dataFile[name] = {};

      // dataFileHandler - established the data connections
      var mergedData;

      for (var label of configHandler.settings[name].configuration.labels) {

        var listeners = {
          error: function(type, err, id) {
            // dataSocket.emit('mistake', { error: err, time: new Date() });
            this.handleErrors(err, "dataFileHandler id: " + id);
          },
          data: function(type, data, id) {
            if (!data || data.length == 0)
              return; // Don't handle empty data
            // temporary save data
            if (configHandler.settings[name].dataConfig[id]) {
              // process data
              mergedData = mergeData(configHandler.settings[name].dataConfig[id], data);
              // serve clients in rooms for labels
              // only newer data is send
              // TODO: handle this optional by config
              if (currentData[name][id] && mergedData.date > currentData[name][id].date) {
                dataSocket.to(name+'__'+id).emit("update", mergedData);
              }
              currentData[name][id] = mergedData;
            }
          }
        };

        if (dataFile[name][label]) {
          dataFile[name][label].close();
          // delete dataFile[name][label];
        }

        dataFile[name][label] = new dataFileHandler({
          id: label,
          connection: configHandler.settings[name].connection[label],
          listener: listeners
        });

        dataFile[name][label].connect();
      }

      // Handle connections of new clients
      dataSocket.on('connection', function(socket) {

        var name = socket.handshake.query.name;
        console.log(socket.handshake.query);

        socket.emit('init', configHandler.settings[name].configuration);

        socket.on('init', function(config) {
          for (var label of config.labels) {
            socket.join(config.name+'__'+label); // client joins room for selected label
            socket.emit('update', currentData[config.name][label]);
          }
        });

        // socket.on('disconnect', function() {
        //   // leave rooms on disconnect
        //   var rooms = io.sockets.manager.roomClients[socket.id];
        //   for (var room in rooms) {
        //     socket.leave(room);
        //   }
        // });
      });

      io.of('/data').clients(function(error, clients) {
        if (error) {
          throw error;
          console.log('data-socket clients error', clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
        }
      });
    }).bind(this))
  }

  disconnect() {
    for (var name in dataFile) {
      for (var label in dataFile[name]) {
        dataFile[name][label].close();
        delete dataFile[name][label];
      }
    }
    io = null;
    dataFile = {};
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
