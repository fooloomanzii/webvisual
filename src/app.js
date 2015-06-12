'use strict';
/**
 * Module dependencies
 */
var dataModule   = require('./data'),                               // custom: DATAMODULE
    routes       = require('./routes'),                             // custom: ROUTING
    mailHelper   = new require('./modules/mailhelper')('exceeds'),  // custom: MAILHELPER
    express      = require('express'),                              // EXPRESS
	  errorHandler = require('express-error-handler'),                // EXPRESS-ERROR-HANDLER
    fs           = require('fs'),               // FS <-- File System
    _            = require('underscore'),       // UNDERSCORE <-- js extensions
    defaultsDeep = require('merge-defaults'),   // DEFAULTSDEEP <-- extended underscrore/lodash _.defaults, for default-value in   deeper structures
    morgan       = require('morgan'),           // MORGAN <-- logger

    // Class variables
    threshold    = dataModule.threshold,        // extension: of DATAMODULE
    DataHandler  = dataModule.DataHandler,      // extension: of DATAMODULE

    // Default config
    defaults     = { connections : [],
                     command_file: 'commands.json',
                     port        : 3000,
    },

    // Configuration from config-file, uses default values, if necessary
    config       = defaultsDeep(require('./config/config.json'), defaults),

    // Server-Log-File and -Mode (used by MORGAN)
    // TODO: if necessary, catch different HTTP errors, or other errors
    serverLogFile    = __dirname + config.files.server_log.relative_path + config.files.server_log.file_name,
    serverLogMode    = { stream: fs.createWriteStream(serverLogFile, {flags: 'a'}),
                       skip: function (req, res) { return res.statusCode < 400 }}
    ;

/**
 * Extend UNDERSCORE
 */
_.mixin({
  exclone: function(object, extra) {
    return _(object).chain().clone().extend(extra).value();
  }
});

/**
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

/**
 * Defining Errors
 */

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

// if Error: Defined in serverLogMode, which kind of errors, are written in SERVERLOGFILE by MORGAN
app.use(morgan('short', serverLogMode));

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

/**
 * Routing
 */

// Route: Default, Home, Index
app.get('/', routes.index);

// Route: External Log File
app.get('/logfile', routes.externalLogFile);

// Route: Data File
app.get('/datafile', routes.dataFile);

// Error: Custom 404 page
app.use(function(req, res) {
	res.status(404);

	// Respond with html page
	if(req.accepts('html')) {
		res.render('404', {
			status: 404,
			title: 'Oops!'
		});
	}
});

/**
* Configure SOCKET.IO (watch the data file)
*/

// Just print warnings
io.set('log level', 1);

// Socket variables
var userCounter = 0,
  currentData = {},
  waitFirst = true,
  states={},
  connections,

// Config Socket
  configSocket = io.of('/config').on('connection', function(socket){
    socket.emit('data', {locals: config.locals});
  }),
// DATAHANDLER - established the data connections
  connections = new DataHandler({
    // Use the Configuration
    connection: config.connections,
    listener: {
      error: function(type, err) {
        dataSocket.emit('mistake', { data: err, time: new Date()});
      },
      data: [

      // SocketIO Listener
      function(type, data) {

        // Store the current message time
        currentData.time=new Date();

        var sendEvent = 'data';

        // Set the first event and add the state, if it is the first parsing
        if(waitFirst) {
          sendEvent = 'first';
          waitFirst = false;
        }

        // Check for threshold exceeds and save it
        currentData.exceeds=threshold.getExceeds(data, function(exceeds){
          // TODO: new exceeds handling in server
          // var exceedsHTML="", numCols=config.locals.data.typeWidth;
          // var i;
          // var pos = exceeds[0].indexOf(true);
          // if(pos > -1){
          //   exceedsHTML += "Under the threshold:<br><ul>";
          //   while(pos > -1){
          //     exceedsHTML+="<li>";
          //     i=parseInt(pos/numCols, 10);
          //     exceedsHTML+=(config.locals.data.types[i]||config.locals.table.unnamedRow+' '+(i+1));
          //     exceedsHTML+=", "+(config.locals.data.subtypes[pos%numCols]||(pos%numCols)+1);
          //     exceedsHTML+=": "+data[data.length-1].values[pos]+";<br>";
          //     exceedsHTML+="</li>";
          //     pos = exceeds[0].indexOf(true,pos+1);
          //   }
          //   exceedsHTML+="</ul>";
          // }
          // pos = exceeds[1].indexOf(true);
          // if(pos > -1){
          //   exceedsHTML += "Over the threshold:<br><ul>";
          //   while(pos > -1){
          //     exceedsHTML+="<li>";
          //     i=parseInt(pos/numCols, 10);
          //     exceedsHTML+=(config.locals.data.types[i]||config.locals.table.unnamedRow+' '+(i+1));
          //     exceedsHTML+=", "+(config.locals.data.subtypes[pos%numCols]||(pos%numCols)+1);
          //     exceedsHTML+=": "+data[data.length-1].values[pos]+";<br>";
          //     exceedsHTML+="</li>";
          //     pos = exceeds[1].indexOf(true,pos+1);
          //   }
          //   exceedsHTML+="</ul>";
          // }
          // if(exceedsHTML) exceedsHTML=currentData.time+":<br>"+exceedsHTML;
          // mailHelper.appendMsg(exceedsHTML);
        });

        // Save the current data
        currentData.data=data;

        // ... finally send the data
        dataSocket.emit(sendEvent, currentData);
      }
    ]
    }
  }),
// Data Socket
  dataSocket = io.of('/data').on('connection', function(socket) {
    // Wait till first data will be sent or receive the current data
    // as 'first' for every Client
    if (!waitFirst) {
      socket.emit('first', currentData);
    } else {
      socket.emit('wait');
    }

  });

/**
 * Get SERVER running!
 */

connections.connect(); // establish all connections
server.listen(config.port);



/**
 * Init MAILHELPER
 */
// mailHelper.init({
//   from: 'SCADA <webvisual.test@gmail.com>', // sender address
//   to: 'dagnarus@live.ru', // list of receivers
//   subject: 'Data'
//  });
// mailHelper.setType('html');
// mailHelper.setDelay(1000);

/*mailHelper.startDelayed(function(error,info){
  if(error){
    console.log('Mailing error: ' + error);
  }else{
    if(info.response) console.log('E-Mail sent: ' + info.response  );
    else{
      for( var i in info.pending[0].recipients[0]) console.log(i);
      console.log('E-Mail sent: ' + info.pending[0].recipients[0]  );
    }
  }
});


/**
 * Handle various process events
 */
process.on('uncaughtException', function(err) {
  try {
    server.close();
  } catch (e) {
    if(e.message !== 'Not running')
      throw e;
  }
  throw err;
});

/* SIGINT can usually be generated with Ctrl-C */
process.on('SIGINT', function(err) {
  try {
    server.close();
  } catch (err) {
    if(err.message !== 'Not running')
      throw err;
  }
});

process.on('exit', function(err) {
  try {
    server.close();
  } catch (err) {
    if(err.message !== 'Not running')
      throw err;
  }
});
