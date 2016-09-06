"use strict";

var ioServer = require("socket.io"),
  EventEmitter = require("events").EventEmitter,
  // custom: DATAMODULE
  filehandler = require("./filehandler"),
  // custom: mailer
  // mailer = new require("./mail")("exceeds"),

  /* Class variables */
  Settings = require("./settings"),
  dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
  mergeData = filehandler.dataMerge; // extension: of DATAMODULE

class dataModule extends EventEmitter {

  constructor(server, config) {
    super();
    this.configHandler = new Settings();
    this.io = new ioServer();
    this.currentData = {};
    this.dataFile = {};

    if(server)
      this.setServer(server);
    if(config)
      this.connect(config);

    // Handle connections of new clients
    this.dataSocket = this.io.of("/data");
    this.dataSocket.on("connection", (function(socket) {

      var name = socket.handshake.query.name;
      // console.log(socket.handshake.query);

      if(this.configHandler.settings[name])
        socket.emit("initByServer", this.configHandler.settings[name].configuration);

      socket.on("initByClient", (function(config) {
        for (var label of config.labels) {
          socket.join(name + "__" + label); // client joins room for selected label
          socket.emit("initial", this.currentData[name][label]);
        }
      }).bind(this));

    }).bind(this));

    this.io.of("/data").clients(
      (function(err, clients) {
        if (err) this.emit("error", "socket.io", err) // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
        }).bind(this));
  }

  setServer(server) {
    this.io.listen(server);
  }

  connect(config) {
    this.configHandler.watch(config);

    this.configHandler.on("changed", (function(name) {
      this.emit("changed", this.configHandler.settings[name].configuration, name);

      this.currentData[name] = {};

      if (!this.dataFile[name])
        this.dataFile[name] = {};

      // close prexisting connections and io-namespace(room)
      for (let label in this.dataFile[name]) {
        this.dataFile[name][label].close();
        delete this.dataFile[name][label];
        delete this.currentData[name][label];
        if (this.configHandler.settings[name].configuration.labels.indexOf(label) === -1) {
          delete this.io.nsps['/' + name + '__' + label];
        }
      }

      // dataFileHandler - established the data connections
      for (let label of this.configHandler.settings[name].configuration.labels) {

        this.currentData[name][label] = [];
        let listeners = {
          error: (function(option, err) {
            let errString = "";
            err.forEach(function(msg){
              errString += "path: " + msg.path + "\n" + msg.details + "\n";
            })
            this.emit("error", option.type + "\n" + errString);
          }).bind(this),
          data: (function(option, data, label) {
            if (!data || data.length == 0)
              return; // Don"t handle empty data
            // temporary save data
            if (this.configHandler.settings[name].dataConfig[label]) {
              // process data
              let mergedData = mergeData(data, name, this.configHandler.settings[name].dataConfig[label]);
              // serve clients in rooms for labels
              // only newer data is send
              // TODO: handle this optional by config
              if (this.currentData[name][label] &&
                  this.currentData[name][label].length &&
                  mergedData.date > this.currentData[name][label][this.currentData[name][label].length - 1].date) {
                this.dataSocket.to(name + "__" + label).emit("update", mergedData);
              }
              // save currentData
              if (option.mode === 'append')
                this.currentData[name][label].push(mergedData);
              else if (option.mode === 'prepend')
                this.currentData[name][label].push(mergedData);
              else this.currentData[name][label] = [mergedData];
            }
          }).bind(this)
        };

        this.dataFile[name][label] = new dataFileHandler({
          id: label,
          connection: this.configHandler.settings[name].connection[label],
          listener: listeners
        });

        this.dataFile[name][label].connect();
      }
    }).bind(this))
  }

  disconnect() {
    for (var name in this.dataFile) {
      for (var label in this.dataFile[name]) {
        this.dataFile[name][label].close();
        delete this.dataFile[name][label];
        delete this.currentData[name][label];
      }
      delete this.dataFile[name];
      delete this.currentData[name];
    }
    this.configHandler.unwatch();
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
  //   mailer.setType("html");
  //   mailer.setDelay(1000);
  // }
}

// Module exports
module.exports = dataModule;
