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
    DBcontroller     = require('./database'),

    /* Class variables */
    threshold        = filehandler.threshold,    // extension: of DATAMODULE
    dataFileHandler  = filehandler.dataFileHandler,  // extension: of DATAMODULE
    dataMerge        = filehandler.dataMerge,    // extension: of DATAMODULE
    configuration    = require('./configuration'),   // extension: of DATAMODULE
    Client           = require('./clients'),       // extension: of DATAMODULE

    /* Current connected clients */
    clients       = {},
    // array of configurations
    configArray   = [],
    // array of various database controllers
    dbControllerArray = [];


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
  var dataConf = [];
  var dataFile = [];

  for (var i = 0; i < configArray.length; i++) {
    dataConf.push(configuration.arrangeTypes( configArray[i].locals ));
    
    dataFile.push(new dataFileHandler( {
        index: i,
        // Object used the Configuration
        connection: configArray[i].connections,
        listener: {
          error: function(type, err, index) {
              dataSocket.emit('mistake', { error: err, time: new Date() });
              console.warn("dataSocket error:\n"+err.stack);
            },
          data: function(type, data, index) {
              // Process data to certain format
              var currentData = dataMerge( index, dataConf[index], {exceeds: threshold(data, dataConf[index].types), data: data } );

              // Save new Data in Database and send for each client the updated Data
              dbControllerArray[index].appendData(
                  currentData.content,
                  function (err, appendedData) {
                    if(err) console.warn(err.stack);
                  }
              );
            }
          }
      })
    );
  }
  // Data Socket
  var dataSocket = io.of('/data');

  // Handle connections of new clients
  dataSocket.on('connection', function(socket) {

    socket.on('clientConfig', function(patterns) {
      var current_client = new Client(socket, patterns);
      for (var i = 0; i < configArray.length; i++) {
        dbControllerArray[i].getData(current_client.firstPattern,
          function (err, data, index) {
            if(err) console.warn(err.stack);

            //TODO: important! if two lines change then send in the same kind of object

            var message = {
               id: index,
               content: data,
               time: new Date(), // current message time
               groupingKeys: configArray[index].locals.groupingKeys,
               exclusiveGroups: configArray[index].locals.exclusiveGroups,
               types: dataConf[index].types,
               unnamedType: dataConf[index].unnamedType
            };
            socket.emit('first', message);

            // append the client to array after sending first message
            current_client.hasFirst=true;
            clients[socket.id] = current_client;
          }
        );
      }

      // by disconnect remove socket from list
      socket.on('disconnect',
        function() {
          delete clients[socket.id];
        }
      );
    });
  });

//TODO !!! change db functions to handle multiple dbmodels!!!
  var serve_clients_with_data = function(updateIntervall){
    //Send new data on constant time intervals
    setInterval(
      function(){
        for (var i = 0; i < dbControllerArray.length; i++)
          dbControllerArray[i].switchTmpDB(function(tmpDB){
            if(!tmpDB) return;
            async.each(clients,
                function(client, callback){
                  dbControllerArray[i].getDataFromModel(tmpDB,
                    client.appendPattern,
                    function (err, data) {
                      if(err){
                        console.warn(err.stack);
                        callback();
                        return;
                      }
                      if(data.length < 1){
                        //empty data
                        return;
                      }
                      var message = {
                         id: i,
                         content: data,
                         time: new Date(), // current message time
                      };
                      client.socket.emit('data', message);
                      callback();
                    }
                  );
                },
                function(err){
                  if(err) console.warn(err.stack);
                  // cleanize current tmp
                  tmpDB.remove({},function(err){
                    if(err) console.warn(err.stack);
                  });
                }
            );
          });
      }, updateIntervall
    );
  };

  /*
   * Get SERVER.io, mongoose and server running!
   */
  for (var i = 0; i < configArray.length; i++) {
    console.log(configArray[i].database.name);
    dbControllerArray.push(new DBcontroller(i));

    dbControllerArray[i].once('open', function (index) {
// TODO: das geht so nicht, weil i nicht mehr vorhanden, wenn das aufgerufen wird
//       man müsste das im device controller erzeugen
//       da muss die Datenbank, die man nutzen möcht angegeben werden und die Konfiguration geschehen#
//       mongoose müsste gar nicht außerhalb existieren

      // register the properties of devices in the database
      dbControllerArray[index].setDevices(dataConf[index].types, function(err){
        if(err) console.warn(err.stack);
      });

      // start the handler for new measuring data
      dataFile[index].connect();

      // make the Server available for Clients
      if(index == configArray.length-1){
        console.log("a");
        server.listen(config.port);
        serve_clients_with_data(config.updateIntervall);
      }
    });
  
    dbControllerArray[i].on('error', function (err) {
      console.warn(err.stack);
    });
  
    dbControllerArray[i].connect(configArray[i].database);
  }
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
