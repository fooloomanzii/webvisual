'use strict';

// Module exports
module.exports = {
  connect:    connect,
  disconnect: disconnect
};

var // ASYNC <-- one callback for a lot of async operations
    async        = require('async'),
    // custom: DATAMODULE
    filehandler   = require('./filehandler'),
    // custom: mailer
    mailer   = new require('./mail')('exceeds'),
    // FS <-- File System
    fs           = require('fs'),

    /* Database Server + Client */
    dbController     = new require('./database')(),

    /* Class variables */
    threshold        = filehandler.threshold,    // extension: of DATAMODULE
    dataFileHandler  = filehandler.dataFileHandler,  // extension: of DATAMODULE
    dataMerge        = filehandler.dataMerge,    // extension: of DATAMODULE
    configuration    = require('./configuration'),   // extension: of DATAMODULE
    Client           = require('./clients'),       // extension: of DATAMODULE

    /* Current connected clients */
    clients       = {},
    // array of configurations
    configArray   = [];

// private function to handle the errors
function handleErrors(errors, id_message){
  if(errors === undefined) return;
  if(_.isArray(errors)){
    errors.forEach(function(err){ handleErrors(err, id_message) });
    return;
  }
  if(id_message === undefined) id_message="";
  else id_message+=": ";
  console.warn( id_message );
  console.warn( errors );
  console.warn( errors.stack );
}

function connect (config, server, err) {

  if(server == undefined || config == undefined) {
 //    err.msg = "No valid configuration file"
    return; // Check the Existence
  }

  //initMailer(config.mail);

  /*
   * Configure SOCKET.IO (watch the data file)
   */

  var io = require('socket.io').listen(server);

// TODO: Test for an array of configurations
  configArray = config.configurations;

  //dataFileHandler - established the data connections
  var dataLabels = [];
  var indexOfLabel = {};
  var dataConf = [];
  var dataFile = [];

  for (var i = 0; i < configArray.length; i++) {
    var label = configArray[i].database.name;
    dataLabels.push( label );
    indexOfLabel[label] = i;
    dataConf.push(configuration.arrangeTypes( configArray[i].locals ));

    dataFile.push(new dataFileHandler( {
      index: i,
      // Object used the Configuration
      connection: configArray[i].connections,
      listener: {
        error: function(type, err, err_index) {
            dataSocket.emit('mistake', { error: err, time: new Date() });
            handleErrors(err, "dataFileHandler");
          },
        data: function(type, data, data_index) {
            // Process data to certain format
            var currentData = dataMerge( dataConf[data_index], {exceeds: threshold(data, dataConf[data_index].types), data: data } );

            // Save new Data in Database and send for each client the updated Data
            dbController.appendData(data_index,
                currentData.content,
                function (err, appendedData, cb_index) {
                  if(err) handleErrors(err, "appendData "+cb_index);
                }
            );
        }
      }
    }));
  }
  // Data Socket
  var dataSocket = io.of('/data');

  // Handle connections of new clients
  dataSocket.on('connection', function(socket) {
    var message = {};
    message.labels = dataLabels;
    socket.emit('clientConfig', message);

    socket.on('clientConfig', function(options) {
      // To Hannes: dass soll bei dem client gebastelt sein
      options.patterns=[ {
        "label": "HNF-GDS",
        "firstPattern": {
          "query": {},
          "time": {
            "from": "2015-11-01"
          },
          "limit": -1
        },
        "appendPattern": {
          "query": {},
          "time": {
            "from": "2015-11-01"
          },
          "limit": -1
        }
      },
      {
        "label": "DBTest",
        "firstPattern": {
          "query": {},
          "time": {
            "from": "2015-11-01"
          },
          "limit": -1
        },
        "appendPattern": {
          "query": {},
          "time": {
            "from": "2015-11-01"
          },
          "limit": -1
        }
      }];

      var current_client = new Client(socket, options);

//TODO create a function in dbcontroller to search for 'current_client.patterns'
      async.map(current_client.patterns,
          function(pattern, async_callback){
            if(indexOfLabel[pattern.label] === undefined){
              handleErrors(new Error("label: "+pattern.label+" is undefined"));
              return;
            }
            dbController.getData(indexOfLabel[pattern.label], pattern.firstPattern,
                function (err, data, index) {
                  if(err) handleErrors(err, "getData "+index);

                  var message_chunk = {
                      label : dataLabels[index],
                      content : data,
                      types : dataConf[index].types,
                      ids : dataConf[index].ids,
                      groups : dataConf[index].groups,
                      groupingKeys : dataConf[index].groupingKeys,
                      preferedGroupingKey : dataConf[index].preferedGroupingKey,
                      keys : dataConf[index].keys,
                      unnamedType : dataConf[index].unnamedType,
                      timeFormat : dataConf[index].timeFormat
                   }

                  async_callback(null, message_chunk);
                }
              );
          },
          // 'message' is an array of all 'message_chunk'
          function(errors, message){
            if(errors){
              handleErrors(errors, "async on client connection");
              if(message === undefined) return;
            }
            socket.emit('first', message);

            // append the client to array after sending first message
            current_client.hasFirst=true;
            clients[socket.id] = current_client;
          }
      );

      // by disconnect remove socket from list
      socket.on('disconnect',
        function() {
          delete clients[socket.id];
        }
      );
    });
  });

//TODO create a function in dbcontroller to replace the 'serve_clients_with_data'
  var serve_clients_with_data = function(updateIntervall){
    //Send new data on constant time intervals
    setInterval(
      function(){
        dataLabels.forEach( function(label, i){
          dbController.switchTmpDB(i, function(tmpDB, tmp_index){
            if(!tmpDB) return; // tmpDB is undefined

            async.each(clients,
                function(client, async_callback){
                  var search_pattern;
                  client.patterns.forEach(function(pattern){
                    // look if that client have a pattern with that label
                    if(pattern.label === dataLabels[tmp_index])
                      search_pattern = pattern.appendPattern;
                  });
                  if(search_pattern === undefined) async_callback();

                  dbController.getDataFromTmpModel(tmp_index, tmpDB,
                      search_pattern,
                      function (err, data, db_index) {
                        if(err){
                          handleErrors(err);
                          async_callback();
                          return;
                        }
                        if(data.length < 1){
                          //data is empty
                          return;
                        }

                        // one message per one tmpDB
                        var message = {
                            label : dataLabels[db_index],
                            content : data,
                            time : new Date(), // current message time
                          };
                        client.socket.emit('data', message);

                        async_callback();
                      }
                  );
                },
                function(err){
                  if(err) handleErrors(err);
                  // cleanize current tmpDB
                  tmpDB.remove({},function(err){
                    if(err) handleErrors(err);
                  });
                }
            );
          });
        })
      }, updateIntervall
    );
  };

  /*
   * Get SERVER.io, mongoose and server running!
   */
  // define Listeners to catch all events after connection to the mongoDB
  dbController.on( 'error', function (err) {
    handleErrors(err, "dbController");
  });

  async.forEachOf(configArray,
      function(config, index, async_callback){

        dbController.createConnection(config.database, index);

        dbController.connect(index, function (err, db_index) {
          if(err) handleErrors(err, "dbController.connect "+db_index);

          // register the properties of devices in the database
          dbController.setDevices(db_index, dataConf[db_index].types, function(err){
            if(err) handleErrors(err, "setDevices "+db_index);
          });

          // start the handler for new measuring data related to configArray[i]
          dataFile[db_index].connect();

          // configArray[i].database is connected
          async_callback();
        });
      },
      // call after all databases are connected
      function(err){
        if(err) handleErrors(err, "async(configArray)");

        // make the Server available for Clients
        server.listen(config.port);
//TODO do serve_clients_with_data in dbcontroller
        serve_clients_with_data(config.updateIntervall);
      }
  );

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

function disconnect() {
  /*for (var i = 0; i < dbControllerArray.length; i++) {
    dbControllerArray[i].disconnect();
  }*/
}

function initMailer(config) {
    /*
     * Init mailer
     */
    mailer.init({
      from:    config.from, // sender address
      to:      config.to,   // list of receivers
      subject: config.subject
     });
    mailer.setType('html');
    mailer.setDelay(1000);

}
