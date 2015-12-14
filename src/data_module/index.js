'use strict';

// Module exports
module.exports = {
  connect : connect,
  disconnect : disconnect
};

var // ASYNC <-- one callback for a lot of async operations
    async = require('async'),
    // custom: DATAMODULE
    filehandler = require('./filehandler'),
    // custom: mailer
    mailer = new require('./mail')('exceeds'),
    // FS <-- File System
    fs = require('fs'),
    // UNDERSCORE <-- js extensions
    _ = require('underscore'),
    // DEFAULTSDEEP <-- extended underscrore/lodash _.defaults,
    // for default-value in   deeper structures
    defaultsDeep = require('merge-defaults'),

    /* Database Server + Client */
    mongoose = require('mongoose'), dbcontroller = require('./database'),
    // The database
    db,
    /* Class variables */
    threshold = filehandler.threshold,             // extension: of DATAMODULE
    dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
    dataMerge = filehandler.dataMerge,             // extension: of DATAMODULE
    configuration = require('./configuration'),    // extension: of DATAMODULE
    Client = require('./clients'),                 // extension: of DATAMODULE

    /* Current connected clients */
    clients = {},

    /* Default config */
    defaults = {
      connections : [],
      port : 3000,
      updateIntervall : 1000,
      dbName : "test"
    };

function connect(config, server, err) {

  if (server == undefined || config == undefined) {
    //    err.msg = "No valid configuration file"
    return; // Check the Existence
  }

  initMailer(config.mail);

  /*
   * Configure SOCKET.IO (watch the data file)
   */

  var io = require('socket.io').listen(server);
  configuration.get();
  // dataFileHandler - established the data connections
  var dataConf = configuration.arrangeTypes(config.locals);
  var dataFile = new dataFileHandler({
    // Object used the Configuration
    connection : config.connections,
    listener : {
      error : function(type, err) {
        dataSocket.emit('mistake', {error : err, time : new Date()});
        console.warn("dataSocket error:\n" + err.stack);
      },
      data : function(type, data) {
        // Process data to certain format
        var currentData = dataMerge(
            dataConf, {exceeds : threshold(data, dataConf.types), data : data});
        var tmpData = data;

        // Save new Data in Database and send for each client the updated Data
        dbcontroller.appendData(currentData.content,
                                function(err, appendedData) {
                                  if (err)
                                    console.warn(err.stack);
                                });
      }
    }
  });

  // Data Socket
  var dataSocket = io.of('/data');

  // Handle connections of new clients
  dataSocket.on('connection', function(socket) {

    // An Alex: message.labels ist neu und wird anders eingelesen werden müssen
    var message = {};
    message.labels = [ "HNF-GDS", "test" ];
    socket.emit('clientConfig', message);
    socket.on('clientConfig', function(localClientSettings) {
      var current_client = new Client(socket, localClientSettings);
      dbcontroller.getData(current_client.firstPattern, function(err, data) {
        if (err)
          console.warn(err.stack);
        // An Alex: das ist anders. Muss angepasst werden an das was der Client
        // über
        var message = [
          {
            label : "HNF-GDS",
            content : data,
            time : new Date(), // current message time
            groupingKeys : config.locals.groupingKeys,
            exclusiveGroups : config.locals.exclusiveGroups,
            types : dataConf.types,
            unnamedType : dataConf.unnamedType
          },
          {
            label : "fault-test",
            content : data,
            time : new Date(), // current message time
            groupingKeys : config.locals.groupingKeys,
            exclusiveGroups : config.locals.exclusiveGroups,
            types : dataConf.types,
            unnamedType : dataConf.unnamedType
          },
          {
            label : "test",
            content : data,
            time : new Date(), // current message time
            groupingKeys : config.locals.groupingKeys,
            exclusiveGroups : config.locals.exclusiveGroups,
            types : dataConf.types,
            unnamedType : dataConf.unnamedType
          }
        ];
        socket.emit('first', message);

        // append the client to array after sending first message
        current_client.hasFirst = true;
        clients[socket.id] = current_client;
      });

      // by disconnect remove socket from list
      socket.on('disconnect', function() { delete clients[socket.id]; });
    });
  });

  var serve_clients_with_data = function(updateIntervall) {
    // Send new data on constant time intervals
    setInterval(function() {
      dbcontroller.switchTmpDB(function(tmpDB) {
        if (!tmpDB)
          return;
        async.each(clients,
                   function(client, callback) {
                     dbcontroller.getDataFromModel(
                         tmpDB, client.appendPattern, function(err, data) {
                           if (err) {
                             console.warn(err.stack);
                             callback();
                             return;
                           }
                           if (data.length < 1) {
                             // empty data
                             return;
                           }
                           // An Alex: das ist anders
                           var message = {
                             label : (Math.floor((Math.random() * 2) + 1) == 1)
                                         ? "HNF-GDS"
                                         : "test",
                             content : data,
                             time : new Date(), // current message time
                           };
                           client.socket.emit('data', message);
                           callback();
                         });
                   },
                   function(err) {
                     if (err)
                       console.warn(err.stack);
                     // cleanize current tmp
                     tmpDB.remove({}, function(err) {
                       if (err)
                         console.warn(err.stack);
                     });
                   });
      });
    }, updateIntervall);
  };

  /*
   * Get SERVER.io and server running!
   */
  mongoose.connect("mongodb://localhost:27017/" + config.database.name);
  db = mongoose.connection;
  // TODO properly react on error
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function(callback) {
    console.log("MongoDB is connected to database '%s'", config.dbName);

    // initialize database controller with values from config,json
    dbcontroller.init(config.database, function(err) {
      if (err) {
        err.forEach(function(error) { console.warn(error.stack); })
      }
    });

    // register the properties of devices in the database
    dbcontroller.setDevices(dataConf.types, function(err) {
      if (err)
        console.warn(err.stack);
    });

    // start the handler for new measuring data
    dataFile.connect();

    // make the Server available for Clients
    server.listen(config.port);

    serve_clients_with_data(config.updateIntervall);

  });

  /*
   * Start Mail Server
   */

  // mailer.startDelayed(function(error,info){
  //   if(error){
  //     console.log('Mailing error: ' + error);
  //   }
  //   else{
  //     if (info.response) console.log('E-Mail sent: ' + info.response);
  //     else{
  //       for( var i in info.pending[0].recipients[0]) console.log(i);
  //       console.log('E-Mail sent: ' + info.pending[0].recipients[0]);
  //     }
  //   }
  // });
}

function disconnect() { mongoose.disconnect(); }

function initMailer(config) {
  /*
   * Init mailer
   */
  mailer.init({
    from : config.from, // sender address
    to : config.to,     // list of receivers
    subject : config.subject
  });
  mailer.setType('html');
  mailer.setDelay(1000);
}
