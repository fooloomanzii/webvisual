'use strict';
/*
 * Module dependencies
 */
var 
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
    datamodel    = datadb.devicedata,
    dbcontroller = new datadb.controller(datamodel, {}),
    // The database
    db,
    /* Class variables */
    threshold    = dataModule.threshold,       // extension: of DATAMODULE
    dataHandler  = dataModule.dataHandler,     // extension: of DATAMODULE
    dataMerge    = dataModule.dataMerge,   // extension: of DATAMODULE

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
      console.log('There has been an error parsing the config-file.')
      console.log(err);
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
    io     = require('socket.io').listen(server, sslOptions);

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

// Socket variables
var userCounter = 0,
    waitFirst = true,
    states={};

    // Config Socket

// var configData,
//     configFile = new dataHandler( {
//       // Object used the Configuration
//       connection: { "file": { "copy"    : false,
//                               "mode"    : "all",
//                               "json"    : true,
//                               "path"    : "/../config/config2.json",
//                               "process" : "" }},
//       listener: {
//         error: function(type, err) {
//           configSocket.emit('mistake', { data: err, time: new Date()});
//         },
//         data: [
//           // SocketIO Listener
//           function(type, data) {
//             // Send the current data;
//             configData = data;
//             configSocket.emit('data', configData);
//             // Update
//           }
//         ]
//       }
//       }),
//     configSocket = io.of('/config')
//                      .on('connection', function(socket){
//                         socket.emit('data', configData);
//                       });
    // DATAHANDLER - established the data connections
var currentData = {},
    lastExceeds = [],
    dataFile = new dataHandler( {
      // Object used the Configuration
      connection: config.connections,
      listener: {
        error: function(type, err) {
          dataSocket.emit('mistake', { error: err, time: new Date()});
      },
      data: [
          // SocketIO Listener
          function(type, data) {

            // Store the current message time
            currentData.time=new Date();

            // Check for threshold exceeds and save it
            currentData.exceeds = threshold.getExceeds(data);
            // Save the current data
            currentData.data = data;
            // Process data to certain format
            currentData = dataMerge.processData(config.locals,currentData);
            
            dbcontroller.appendDataArray(
                currentData.content, 
                function (err, apiResponse) {
                  if(err) return console.log(err);
                  //dbcontroller.getTest(console.log);
            });
            
            // TODO: fix mailhelper message

            // TODO: 
            // Set the first event and add the state, if it is the first parsing and send the data
            if(waitFirst) {
              currentData.language = config.locals.language;
              currentData.groupingKeys = config.locals.groupingKeys;
              currentData.exclusiveGroups = config.locals.exclusiveGroups;
              dataSocket.emit("first", currentData);
              waitFirst = false;
            } else {
              dataSocket.emit("data", currentData);
            }
          }
        ]
      }
    }),
    // Data Socket
    dataSocket = io.of('/data')
                   .on('connection', function(socket) {
                     console.log(socket);
                      // Wait till first data will be sent or receive
                      // the current data as 'first' for every Client
                      if (!waitFirst) {
                        currentData.language = config.locals.language;
                        currentData.groupingKeys = config.locals.groupingKeys;
                        currentData.exclusiveGroups = config.locals.exclusiveGroups;
                        socket.emit('first', currentData);
                      } else {
                        socket.emit('wait');
                      }
                    });

    // external-Log-File-Socket
// var logData = {},
//     externalLogFile = new dataHandler( {
//       // Object used the Configuration
//       connection: { "file": { "copy"    : false,
//                               "mode"    : "all",
//                               "path"    : config.logs.external_log,
//                               "process" : "" }},
//       listener: {
//         error: function(type, err) {
//           logSocket.emit('mistake', { data: err, time: new Date()});
//         },
//         data: [
//           // SocketIO Listener
//           function(type, data) {
//
//             // //- Store the current message time
//             // logData.time=new Date();
//             //
//             // var sendEvent = 'externalLog';
//             //
//             // // Set the first event and add the state, if it is the first parsing
//             // if(waitFirst) {
//             //   sendEvent = 'first';
//             //   waitFirst = false;
//             // }
//             //
//             // //- Save the current data
//             logData.data=data;
//             // console.log(data);
//
//             //- ... finally send the data
//             logSocket.emit('externalLog', logData);
//           }
//         ]
//       }
//     }),
//     logSocket = io.of('/log')
//                    .on('connection', function(socket) {
//                       console.log(logData.data);
//                       socket.emit('message', logData.data);
//                      });

/*
 * Get SERVER.io and server running!
 */
mongoose.connect("mongodb://localhost:27017/");
db = mongoose.connection;
//TODO properly react on error
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  datamodel.remove({},function(){
  
  // start the handler for new measuring data
  dataFile.connect();
  // establish connection with other sockets
  //configFile.connect(); 
  //externalLogFile.connect();
  
  // make the Server available for Clients
  server.listen(config.port);
  
  });
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
process.on('uncaughtException', function(err) {
  try {
    console.warn(err.message);
  } catch (e) {
    if(e.message !== 'Not running') {}
    server.close();
    mongoClient.close();
      throw e;
  }
  throw err;
});

/* SIGINT can usually be generated with Ctrl-C */
process.on('SIGINT', function(err) {
  try {
    server.close();
    mongoClient.close();
  } catch (err) {
    if(err.message !== 'Not running')
      throw err;
  }
});

process.on('exit', function(err) {
  try {
    server.close();
    mongoClient.close();
  } catch (err) {
    if(err.message !== 'Not running')
      throw err;
  }
});
