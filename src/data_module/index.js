'use strict';

// Module exports
module.exports = {
  connect: connect,
  disconnect: disconnect
};

var io = require('socket.io')(),
  dataSocket = io.of('/data'),
  // custom: DATAMODULE
  filehandler = require('./filehandler'),
  // custom: mailer
  mailer = new require('./mail')('exceeds'),
  // FS <-- File System
  fs = require('fs'),

  /* Class variables */
  threshold = filehandler.threshold, // extension: of DATAMODULE
  dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
  mergeData = filehandler.dataMerge, // extension: of DATAMODULE
  arrangeTypes = require('./configuration').arrangeTypes, // extension: of DATAMODULE

  // currentData temporary saved for the first sending (unnecessary with db requests)
  currentData = {},
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

  io.listen(server);

  // TODO: Test for an array of configurations
  configArray = config.configurations;

  // dataFileHandler - established the data connections
  var availableLabels = [];
  var dataConfig = {};
  var dataFile = {};

  for (var i = 0; i < configArray.length; i++) {
    var label = configArray[i].label;

    availableLabels.push(label);

    dataConfig[label] = arrangeTypes(label, i, configArray[i].locals);

    var listeners = {
      error: function(type, err, label) {
        // dataSocket.emit('mistake', { error: err, time: new Date() });
        handleErrors(err, "dataFileHandler label: "+label);
      },
      data: function(type, data, label) {
        if (!data || data.length == 0)
          return; // Don't handle empty data

        // temporary save data
        if (dataConfig[label]) {
          // process data
          currentData[label] = mergeData(dataConfig[label], {
            exceeds: threshold(data, dataConfig[label].types),
            data: data
          });
          // serve clients in rooms for labels
          dataSocket.to(label).emit("update", currentData[label]);
        }
      }
    }
    dataFile[label] = new dataFileHandler({
      label: label,
      connection: configArray[i].connections,
      listener: listeners
    });
    dataFile[label].connect();
  }

  // configuration ordering
  var configuration = {
    groupingKeys: {},
    dataStructure: [],
    paths: {},
    preferedGroupingKeys: {},
    labels: availableLabels,
    svgSources: []
  };
  for (var label in dataConfig) {
    configuration.groupingKeys[label] = dataConfig[label].groupingKeys;
    configuration.paths[label] = dataConfig[label].paths;
    configuration.preferedGroupingKeys[label] = dataConfig[label].preferedGroupingKey;
    configuration.dataStructure.push({
      label: label,
      groups: dataConfig[label].groups
    });
    for (var j = 0; j < dataConfig[label].svgSources.length; j++) {
      if (configuration.svgSources.lastIndexOf(dataConfig[label].svgSources[j]) == -1)
        configuration.svgSources.push(dataConfig[label].svgSources[j]);
    }
  }

  // Handle connections of new clients
  dataSocket.on('connection', function(socket) {

    socket.emit('init', configuration);

    socket.on('init', function(config) {
      for (var label of config.labels) {
        socket.join(label); // client joins room for selected label
        socket.emit('update', currentData[label]);
      }
    });
  });

  io.of('/data').clients(function(error, clients) {
    if (error) {
      throw error;
      console.log('data-socket clients error', clients); // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
    }
  });

  server.listen(config.port);
}

function serveData(label, content) {
  dataSocket.to(label).emit("update", content);
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
