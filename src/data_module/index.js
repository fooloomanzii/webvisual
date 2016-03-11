'use strict';

// Module exports
module.exports = {
  connect: connect,
  disconnect: disconnect
};

var // ASYNC <-- one callback for a lot of async operations
async = require('async'),
  // custom: DATAMODULE
  filehandler = require('./filehandler'),
  // custom: mailer
  mailer = new require('./mail')('exceeds'),
  // FS <-- File System
  fs = require('fs'),

  /* Database Server + Client */
  dbController = new require('./database')(),

  /* Class variables */
  threshold = filehandler.threshold, // extension: of DATAMODULE
  dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
  dataMerge = filehandler.dataMerge, // extension: of DATAMODULE
  configHandler = require('./configuration'), // extension: of DATAMODULE
  Client = require('./clients'), // extension: of DATAMODULE

  /* Current connected clients */
  clients = {},
  // array of configurations
  configArray = [];

// private function to handle the errors
function handleErrors(errors, id_message) {
  console.log("error");
  if (errors === undefined)
    return;
  if (_.isArray(errors)) {
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

function connect(config, server, err) {

  if (server == undefined || config == undefined) {
    //    err.msg = "No valid configuration file"
    return; // Check the Existence
  }
  // initMailer(config.mail);
  /*
   * Configure SOCKET.IO (watch the data file)
   */

  var io = require('socket.io').listen(server);

  // TODO: Test for an array of configurations
  configArray = config.configurations;

  // dataFileHandler - established the data connections
  var dataLabels = [];
  var indexOfLabel = {};
  var dataConf = [];
  var dataFile = [];

  for (var i = 0; i < configArray.length; i++) {
    var label = configArray[i].label;
    // labels (database names) are unique
    if (dataLabels.indexOf(label) != -1)
      throw new Error('Multiple occurrences of Label: "' + label + '"\n' +
        'Database Names needs to be unique!!')

    dataLabels.push(label);

    indexOfLabel[label] = i;
    dataConf.push(configHandler.arrangeTypes(label, i, configArray[i].locals));

    var listeners = {
      error: function(type, err, err_index) {
        // dataSocket.emit('mistake', { error: err, time: new Date() });
        handleErrors(err, "dataFileHandler");
      },
      data: function(type, data, labelIndex) {
        if (!data || data.length == 0)
          return; // Don't handle empty data

        // Process data to certain format
        var currentData = dataMerge(dataConf[labelIndex], {
          exceeds: threshold(data, dataConf[labelIndex].types),
          data: data
        });

        console.log(JSON.stringify(clients));

        // Save new Data in Database
        for (var socketId in clients) {
          // console.log(socketId + ' ' + (new Date()).toLocaleTimeString());
          clients[socketId].socket.emit('data', {
            label: dataLabels[labelIndex],
            content: currentData.content,
            time: new Date(), // current message time
          });
        }
      }
    }
    dataFile.push(new dataFileHandler({
      index: i,
      // Object used the Configuration
      connection: configArray[i].connections,
      listener: listeners
    }));
    dataFile[i].connect();
  }

  // configuration ordering
  var configuration = {
    groupingKeys: {},
    dataStructure: [],
    paths: {},
    preferedGroupingKeys: {},
    labels: dataLabels,
    indexOfLabel: indexOfLabel,
    svgSources: []
  };
  for (var i = 0; i < dataConf.length; i++) {
    var label = dataLabels[i];
    configuration.groupingKeys[label] = dataConf[i].groupingKeys;
    configuration.paths[label] = dataConf[i].paths;
    configuration.preferedGroupingKeys[label] = dataConf[i].preferedGroupingKey;
    configuration.dataStructure.push({
      label: label,
      groups: dataConf[i].groups
    });
    for (var j = 0; j < dataConf[i].svgSources.length; j++) {
      if (configuration.svgSources.lastIndexOf(dataConf[i].svgSources[j]) == -1)
        configuration.svgSources.push(dataConf[i].svgSources[j]);
    }
  }

  // Data Socket
  var dataSocket = io.of('/data');

  // Handle connections of new clients
  dataSocket.on('connection', function(socket) {

    socket.emit('clientConfig', configuration, socket.id);

    socket.on('clientConfig', function(options) {
      var current_client = new Client(socket, options);
      console.log(socket.id);

      socket.emit('data', []);

      // append the client to array after the first message is sent
      current_client.hasFirst = true;
      clients[socket.id] = current_client;

      socket.on('disconnect', function() {
        // if client is disconnected, remove them from list
        delete clients[socket.id];
      });
    });
  });

  io.of('/data').clients(function(error, clients) {
    if (error) {
      throw error;
      console.log(clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
    }
  });

  server.listen(config.port);
}

function disconnect() {
}

function initMailer(config) {
  /*
   * Init mailer
   */
  mailer.init({
    from: config.from, // sender address
    to: config.to, // list of receivers
    subject: config.subject
  });
  mailer.setType('html');
  mailer.setDelay(1000);
}
