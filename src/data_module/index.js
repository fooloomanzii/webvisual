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

function handleError(error, id_message){
  if(error === undefined) return;
  if(id_message === undefined) id_message="";
  else id_message+=": ";
  console.warn( error.message+": "+error.stack );
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
              handleError(err, "dataFileHandler");
            },
          data: function(type, data, index) {
              // Process data to certain format
              var currentData = dataMerge( index, dataConf[index], {exceeds: threshold(data, dataConf[index].types), data: data } );

              // Save new Data in Database and send for each client the updated Data
              dbControllerArray[index].appendData(
                  currentData.content,
                  function (err, appendedData) {
                    if(err) handleError(err, "appendData "+index);
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
      dbController.getData(current_client.dataIndex, current_client.firstPattern,
        function (err, data, index) {
          if(err) handleError(err, "getData "+index);

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
        for (var i = 0; i < configArray.length; i++)
          dbController.switchTmpDB(i, function(index, tmpDB){
            if(!tmpDB) return;
            async.each(clients,
                function(client, async_callback){
                  if(client.dataIndex != index) async_callback();
                  dbController.getDataFromTmpModel(index,
                    client.appendPattern,
                    function (err, data, db_index) {
                      if(err){
                        handleError(err);
                        async_callback();
                        return;
                      }
                      if(data.length < 1){
                        //empty data
                        return;
                      }
                      var message = {
                         id: db_index,
                         content: data,
                         time: new Date(), // current message time
                      };
                      client.socket.emit('data', message);
                    async_callback();
                    }
                  );
                },
                function(err){
                  if(err) handleError(err);
                  // cleanize current tmp
                  tmpDB.remove({},function(err){
                    if(err) handleError(err);
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
  // define Listeners to catch all events after connection to the mongoDB
  dbController.on( 'error', function (err) {
    handleError(err, "dbController");
  });

  async.forEachOf(configArray, 
      function(config_i, i, async_callback){

        dbController.createConnection(config_i.database, i);

        dbController.connect(i, function (index) {
          // register the properties of devices in the database
          dbController.setDevices(index, dataConf[index].types, function(err){
            if(err) handleError(err, "setDevices "+index);
          });
    
          // start the handler for new measuring data related to configArray[i]
          dataFile[index].connect();
          
          // configArray[i].database is connected
          async_callback();
        });
      },
      // call after all databases are connected
      function(err){
        if(err) handleError(err, "async(configArray)");
        
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
