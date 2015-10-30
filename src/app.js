'use strict';
/*
 * Module dependencies
 */
var // ASYNC <-- one callback for a lot of async operations
    async        = require('async'),
    // custom: DATAMODULE
    dataModule   = require('./data'),
    // custom: ROUTING
    routes       = require('./routes'),
    // custom: MAILHELPER
    mailHelper   = new require('./modules/mailhelper')('exceeds'),
    // EXPRESS
    express      = require('express'),
    // EXPRESS-ERROR-HANDLER
    errorHandler = require('express-error-handler'),
    // FS <-- File System
    fs           = require('fs'),
    // UNDERSCORE <-- js extensions
    _            = require('underscore'),
    // DEFAULTSDEEP <-- extended underscrore/lodash _.defaults,
    // for default-value in   deeper structures
    defaultsDeep = require('merge-defaults'),
    // MORGAN <-- logger
    morgan       = require('morgan'),
    // dateFormat
    dateFormat   = require('dateFormat'),

    /* Database Server + Client */
    //TODO mongoose lösung finden
    mongoose     = require('mongoose'),
    datadb       = require('./modules/datadb'),
    datamodel    = datadb.storagemodel,
    dbcontroller = new datadb.controller(datamodel, {}),
    // The database
    db,
    /* Class variables */
    threshold    = dataModule.threshold,    // extension: of DATAMODULE
    dataHandler  = dataModule.dataHandler,  // extension: of DATAMODULE
    dataMerge    = dataModule.dataMerge,    // extension: of DATAMODULE
    dataConfig   = dataModule.dataConfig,   // extension: of DATAMODULE
    Client       = dataModule.client,       // extension: of DATAMODULE

    /* Current connected clients */
    clients      = {},

    /* Default config */
    defaults     = { connections : [],
                     command_file: 'commands.json',
                     port        : 3000,
    };

    // Configuration from config-file, uses default values, if necessary
    // TODO: make configs dynamical loaded (or watched)

var config;

    try {
      config = JSON.parse(fs.readFileSync(__dirname + '/config/config.json'));
    }
    catch (err) {
      console.warn('There has been an error parsing the config-file.')
      console.warn(err.stack);
    }

    // Use defaults for undefined values
    config = defaultsDeep(config,defaults);

/*
 * Extend UNDERSCORE
 */
_.mixin({
  exclone: function(object, extra) {
    return _(object).chain().clone().extend(extra).value();
  }
});

/*
 * Configure the APP
 */

// Configure SSL Encription
var sslOptions  = {
    key: fs.readFileSync(__dirname + '/ssl/server.key'),
    cert: fs.readFileSync(__dirname + '/ssl/server.crt'),
    ca: fs.readFileSync(__dirname + '/ssl/ca.crt'),
    requestCert: true,
    rejectUnauthorized: false
  };

// General
var app    = express(),
    server = require('https').createServer(sslOptions, app),
    io     = require('socket.io').listen(server, sslOptions); //

// Path to static folder
app.use(express.static(__dirname + '/public'));

// Configure VIEW ENGINE
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

/*
 * Defining Errors
 */

// if Error: Defined in serverLogMode, which kind of errors, are written in HTTPSERVERLOGFILE by MORGAN
// Server-Log-File and -Mode (used by MORGAN) for Server-Mistakes (Http-Status-Code above 500)
// TODO: if necessary, catch different HTTP errors, or other errors
var serverLogFile    = __dirname + config.logs.http_server_log,
    serverLogMode    = { stream: fs.createWriteStream(serverLogFile, {flags: 'a'}),
                        skip: function (req, res) { return res.statusCode < 500 }},
    logFormat        = ':date[clf] - ":status" - :remote-addr - ":method :url" - :response-time ms :res[content-length]';
app.use(morgan(logFormat, serverLogMode));

// if Error: EADDRINUSE --> log in console
server.on('error', function (e) {
    if (e.code == 'EADDRINUSE') {
      console.log('Port '+config.port+' in use, retrying...');
      console.log("Please check if \"node.exe\" is not already running on this port.");
      setTimeout(function () {
        if(running) server.close();
        server.listen(config.port);
      }, 1000);
    }
  })
  .once('listening', function() {
    console.log("Server is running under Port %d in %s mode",
        config.port, app.settings.env);
  });

  // handling ENVIRONMENTS
  // TODO: find better seperation, what to do in differnet production environments
  // Development
  if ( app.get('env') == 'development' ) {
    // Make the Jade output readable
    app.locals.pretty = true;
    // Make the Jade output readable and add the environment specification
    _.extend(app.locals, {
      env:    'development',
      pretty: true,
    });
  }
  // Production
  if ( app.get('env') == 'production' ) {
    // Set the environment specification for jade
    app.locals.env = 'production';
  }

/*
 * Routing (./routes/index.js)
 */

// Route: Default, Home, Index
app.get('/', routes.index);

// Route: External Log File
app.get('/log', routes.externalLogFile);

// Route: Data File
app.get('/data', routes.dataString);

// Route: Data File
app.get('/settings', routes.settingsJSON);


// Error: Custom 404 page
app.use(function(req, res) {
  res.status(404);

  // Respond with html page
  if(req.accepts('html')) {
    res.render('404');
  }
});


/*
 * Init MAILHELPER
 */
mailHelper.init({
  from:    config.mail.from, // sender address
  to:      config.mail.to,   // list of receivers
  subject: config.mail.subject
 });
mailHelper.setType('html');
mailHelper.setDelay(1000);


/*
 * Configure SOCKET.IO (watch the data file)
 */

//DATAHANDLER - established the data connections
var dataConf = dataConfig.getConfig (config.locals);
var dataFile = new dataHandler( {
      // Object used the Configuration
      connection: config.connections,
      listener: {
        error: function(type, err) {
          dataSocket.emit('mistake', { error: err, time: new Date()});
      },
      data: [
          // SocketIO Listener
          function(type, data) {

            // Process data to certain format
            var currentData = dataMerge.processData ( dataConf,
                              {exceeds: threshold.getExceeds(data), data: data });
            var tmpData = data;

            dbcontroller.appendData(
              currentData.content,
              function (err, appendedData, tmpDB) {
                if(err) console.warn(err.stack);
                if(!tmpDB) return;
                async.each(clients, 
                    function(client, callback){
                      dbcontroller.getUpdate(tmpDB,
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
              }
            );
          }
        ]
      }
    });

// Send new data on constant time intervals
/*var i =0;
setInterval(function() {

}, config.updateIntervall)*/

// Data Socket
var dataSocket = io.of('/data');

// Handle connections of new clients
dataSocket.on('connection', function(socket) {

  socket.on('clientConfig', function(patterns) {
    var current_client = new Client(socket, patterns);
    dbcontroller.getData(current_client.firstPattern,
      function (err, data) {
        if(err) console.warn(err.stack);

        //TODO: important! if two lines change then send in the same kind of object

        var message = {
           content: data,
           time: new Date(), // current message time
           language: config.locals.language,
           groupingKeys: config.locals.groupingKeys,
           exclusiveGroups: config.locals.exclusiveGroups,
           types: dataConf.types,
           unnamedType: dataConf.unnamedType
        };
        socket.emit('first', message);

        // append the client to array after sending first message
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

/*
 * Get SERVER.io and server running!
 */
mongoose.connect("mongodb://localhost:27017/");
db = mongoose.connection;
//TODO properly react on error
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  //datamodel.remove({},function(){ //clean up the database

  // start the handler for new measuring data
  dataFile.connect();

  // make the Server available for Clients
  server.listen(config.port);

  //});
});

/*
 * Start Mail Server
 */

// mailHelper.startDelayed(function(error,info){
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

/*
 * Handle various process events
 */

 // TODO: make shure that the server is not closing (or is restarting) with errors
 // and pretty this part
process.on('uncaughtException', function(err) {
  try {
    server.close();
    mongoose.disconnect();
    console.warn(err.message);
  } catch (e) {
    if(e.message !== 'Not running')
      throw e;
  }
  throw err;
});

/* SIGINT can usually be generated with Ctrl-C */
process.on('SIGINT', function(err) {
  try {
    console.log('close server');
    server.close();
    console.log('disconnect db');
    mongoose.disconnect();
  } catch (err) {
    if(err.message !== 'Not running')
      throw err;
  }
});

process.on('exit', function(err) {
  try {
    server.close();
    mongoose.disconnect();
  } catch (err) {
    if(err.message !== 'Not running')
      throw err;
  }
});
