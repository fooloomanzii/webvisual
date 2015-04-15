'use strict';

/**
 * Module dependencies
 */
var dataModule = require('./data'),
  routes     = require('./routes'),
  mailHelper = new require('./modules/mailhelper')('exceeds'),
  express    = require('express'),
	errorHandler = require('express-error-handler'),
  fs         = require('fs'),
  _          = require('underscore'),
  defaultsDeep = require('merge-defaults'), //extended _.defaults
// Class variables
  threshold   = dataModule.threshold,
  DataHandler = dataModule.DataHandler,
// Default config
  defaults = {
    connections: [],
    command_file: 'commands.json',
    port: 3000,
    locals:{
      dataTimeLabel:"Last Message",
      timeFormat:"dd.MM.yyyy HH:mm:ss",

      typeWidth:2,

      types: [
        {"room":"",
          "kind":"",
          "subtypes":[{"var":"x" , "unit":"", "threshold": []},
                      {"var":"x" , "unit":"", "threshold": []}]}
        ],

      unnamedType : {"room" : "Raum nicht definiert", "kind" : "Datenmessung "},
      unnamedSubtype : {"var":"x" , "unit":"", "threshold": []},

      colors:{
        "under":"#c6ff00",
        "over":"#ff1744",
        "header":[
          {"room":"Raum nicht definiert","color":"#9a9a9a"}
        ]
      }
    }
  },
// Configuration, uses default values, if necessary
  config     = defaultsDeep(require('./config/config.json'), defaults),
  logFile    = __dirname + '/log.txt',
  logMode,
  commands,
// Command object
  cmd_txt = {
    "on": ((config.states && config.states[0]) ? config.states[0] : "ON"),
    "off": ((config.states && config.states[1]) ? config.states[1] : "OFF")
  },
// Function that receives errors
  errfunc = function(err,socket) {
    console.log('error');
    socket.emit('error', {data: err});
    return;
  };

/**
 * Extend Underscore
 */
_.mixin({
  exclone: function(object, extra) {
    return _(object).chain().clone().extend(extra).value();
  }
});

mailHelper.init({
  from: 'SCADA <webvisual.test@gmail.com>', // sender address
  to: 'dagnarus@live.ru', // list of receivers
  subject: 'Data'
 });
mailHelper.setType('html');
mailHelper.setDelay(1000);

/**
 * Configure the app
 */

var app    = express(),
  server = require('http').createServer(app),
  io     = require('socket.io').listen(server);

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

// Development
if ( app.get('env') == 'development' ) {
  // Make the Jade output readable
  app.locals.pretty = true;

  // Error Handler
  app.use(errorHandler({
    dumpExceptions: true,
    showStack:      true
  }));

  // In development mode write the development log in stdout
  logMode = 'dev';

  // Make the Jade output readable and add the environment specification
  _.extend(app.locals, {
    env:    'development',
    pretty: true,
  });
}

// Production
if ( app.get('env') == 'production' ) {
	// In production mode write the log in a seperate file
	logMode = {
		format: 'default',
		stream: fs.createWriteStream(logFile, {flags: 'a'})
	};

	// Set the environment specification for jade
	app.locals.env = 'production';
}

// Configure all environments
	app.set('view engine', 'jade');
	app.set('views', __dirname + '/views');
	// Logging middleware
	// TODO: Dafuer sorgen, dass jede Verbindung nur einmal geloggt wird.
	// Ergo: Irgendwie die statischen Dateien nicht loggen
	// app.use(express.logger(logMode));

/**
 * Routing
 */

app.get(['/', '/home', '/index'], routes.index);
app.get('/table', routes.table);

// Path to static folder
app.use(express.static(__dirname + '/public'));
// Custom 404 page
app.use(function(req, res) {
	res.status(404);

	// Respond with html page
	if(req.accepts('html')) {
		res.render('404', {
			status: 404,
			title:  'Oops!'
		});
	}

});


/**
* Configure Socket.io
*/

// Just print warnings
io.set('log level', 1);

// Socket variables
var userCounter = 0,
  currentData = {},
  waitFirst = true,
  states={},
  connections,
// Checks the funktions_file for new functions and command_file for available states;
// reading synchronously isn't a problem here, since this just happens on startup
  checkstates = function() {
    commands={};

    //if command file exists, read the data from there
    if(fs.existsSync(config.command_file)) {
      try{
        commands = JSON.parse(fs.readFileSync(config.command_file, 'utf8'));
      } catch (err) {
        if (err.code == 'EBUSY') { //the file is busy
          console.log("Can't read file ''"+config.command_file+"'");
        } else { //the file has incorrect JSON data, the backup will be made
          var newname = config.command_file+'.bak',
            i=1;
          while(fs.existsSync(newname)){
            newname=config.command_file+'.bak_'+i;
            i++;
          }
          fs.renameSync(config.command_file,newname);
          console.log("File "+config.command_file+
                " has incorrect JSON data and was renamed to "+newname);
        }
      }
    }
    // be sure, that functions are there
    if(!commands.functions){
      commands.functions={};
    }
    // Check all existing states from command_file.
    // If command_file hasen't any function or the state is wrong,
    // it will be checked in config.
    // Wrong states in config will become a value 'true'.
    for(var func in config.functions) {
      if(commands.functions[func] &&
          (commands.functions[func]===cmd_txt.on ||
              commands.functions[func]===cmd_txt.off)){
        states[func]=(commands.functions[func] !== cmd_txt.off);
      } else {
        states[func]=(config.functions[func] !== cmd_txt.off);
        commands.functions[func]=(states[func]?cmd_txt.on:cmd_txt.off);
      }
    }
    try{
      fs.writeFileSync(config.command_file, JSON.stringify(commands, null, "\t"));
    } catch (err) {
        console.log(err);
    }
  },
// A set of commands which can be executed when the command event is fired;
// the cmd_onoff is used to assign the same function to multiple elements
  cmd_onoff, cmd_fnct = {
    "off": (cmd_onoff = function(socket, command) {
      //Changes the state
      states[command[0]] = (command[1] !== "off");
      // Emits the command so the other notice that something happened
      optionsSocket.emit('command', {cmd: command});
      // Write a command into the config
      commands.functions[command[0]]=command[1];
      fs.writeFile(config.command_file, JSON.stringify(commands, null, "\t"),
          function(err){
        if(err) errfunc(err,socket);
      });
    }),
    "on": cmd_onoff
  },
// The options socket
  optionsSocket = io.of('/options').on('connection', function(socket) {
    // Listen for the command event
    socket.on('command', function(message) {
      if(message === undefined || message.cmd === undefined) {
        return;
      }
      var command = message.cmd;
      // Execute the given command

      if(cmd_fnct[command[1]]) cmd_fnct[command[1]](socket, command);
    });

    // Send the data
    socket.emit('data', {states: states});
  }),


// The config socket
  configSocket = io.of('/config').on('connection', function(socket){
    socket.emit('data', {locals: config.locals});
  }),
// The data handler - established the data connections
  connections = new DataHandler({
    // Use the default configuration
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
          var exceedsHTML="", numCols=config.locals.data.typeWidth;
          var i;
          var pos = exceeds[0].indexOf(true);
          if(pos > -1){
            exceedsHTML += "Under the threshold:<br><ul>";
            while(pos > -1){
              exceedsHTML+="<li>";
              i=parseInt(pos/numCols, 10);
              exceedsHTML+=(config.locals.data.types[i]||config.locals.table.unnamedRow+' '+(i+1));
              exceedsHTML+=", "+(config.locals.data.subtypes[pos%numCols]||(pos%numCols)+1);
              exceedsHTML+=": "+data[data.length-1].values[pos]+";<br>";
              exceedsHTML+="</li>";
              pos = exceeds[0].indexOf(true,pos+1);
            }
            exceedsHTML+="</ul>";
          }
          pos = exceeds[1].indexOf(true);
          if(pos > -1){
            exceedsHTML += "Over the threshold:<br><ul>";
            while(pos > -1){
              exceedsHTML+="<li>";
              i=parseInt(pos/numCols, 10);
              exceedsHTML+=(config.locals.data.types[i]||config.locals.table.unnamedRow+' '+(i+1));
              exceedsHTML+=", "+(config.locals.data.subtypes[pos%numCols]||(pos%numCols)+1);
              exceedsHTML+=": "+data[data.length-1].values[pos]+";<br>";
              exceedsHTML+="</li>";
              pos = exceeds[1].indexOf(true,pos+1);
            }
            exceedsHTML+="</ul>";
          }
          if(exceedsHTML) exceedsHTML=currentData.time+":<br>"+exceedsHTML;
          mailHelper.appendMsg(exceedsHTML);
        });

        // Save the current data
        currentData.data=data;

        // ... finally send the data
        dataSocket.emit(sendEvent, currentData);
      }
    ]
    }
  }),
// The data socket
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
 * Get it running!
 */
checkstates(); // check states of options
connections.connect(); // establish all connections
server.listen(config.port); // get the server running

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
