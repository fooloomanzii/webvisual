"use strict";

var ioServer = require("socket.io"),
	EventEmitter = require("events").EventEmitter,
	// custom: DATAMODULE
	filehandler = require("./filehandler"),
	// custom: mailer
	// mailer = new require("./mail")("exceeds"),

	/* Class variables */
	Settings = require("./settings"),
	Cache = require("./cache"),
	dataFileHandler = filehandler.dataFileHandler, // extension: of DATAMODULE
	mergeData = filehandler.dataMerge; // extension: of DATAMODULE

class dataModule extends EventEmitter {

	constructor(server, config) {
		super();
		this.configHandler = new Settings();
		this.io = new ioServer();
		this.cache = {};
		this.dataFile = {};

		if (config)
			this.connect(config);

		if (server)
			this.setServer(server);
	}

	setServer(server) {
		this.io.listen(server);

		// Handle connections of new clients
		this.dataSocket = this.io.of("/data");
		this.dataSocket.on("connection", (client) => {

			client.on("setup", (settings) => {
				var name = settings.name;
				if (settings) {
					client.compress(true).emit("init-by-server", this.configHandler.settings[name].configuration);
				}
			});

			client.on("init-by-client", (config) => {
				var name = config.name;
				var mobile = config.mobile;
				var requestlast;
				var settings = this.configHandler.settings[name];

				for (var label of config.labels) {

					if (settings && settings.clientRequest[label] &&
							settings.clientRequest[label].initial) {
						if (mobile && settings.clientRequest[label].initial.mobile)
							requestlast = settings.clientRequest[label].initial.mobile;
						else if (!mobile && settings.clientRequest[label].initial.stationary)
							requestlast = settings.clientRequest[label].initial.stationary;
					}

					client.compress(true).emit("initial", {label: label, values: this.cache[name][label].request(requestlast)});

					client.join(name + "__" + label); // client joins room for selected label
				}
			});

			client.on("disconnect", (socket) => { });

			client.on("error", (err) => { });
		});

		this.io.of("/data").clients((err, clients) => {
			if (err) this.emit("error", "socket.io", err) // => [PZDoMHjiu8PYfRiKAAAF, Anw2LatarvGVVXEIAAAD]
		});
	}

	connect(config) {
		this.configHandler.watch(config);

		this.configHandler.on("changed", (name) => {
			this.emit("changed", this.configHandler.settings[name].configuration, name);

			this.cache[name] = {};

			if (!this.dataFile[name])
				this.dataFile[name] = {};

			// close prexisting connections and io-namespace(room)
			for (let label in this.dataFile[name]) {
				this.dataFile[name][label].close();
				delete this.dataFile[name][label];
			}

			// dataFileHandler - established the data connections
			for (let label of this.configHandler.settings[name].configuration.labels) {

				this.cache[name][label] = new Cache();
				let listeners = {
					error: (option, err) => {
						let errString = "";
						err.forEach(function(msg) {
							errString += "path: " + msg.path + "\n" + msg.details + "\n";
						})
						this.emit("error", option.type + "\n" + errString);
					},
					data: (option, data, label) => {
						if (!data || data.length == 0)
							return; // Don"t handle empty data
						// temporary save data
						if (this.configHandler.settings[name] && this.configHandler.settings[name].dataConfig[label]) {
							// process data
							let mergedData = mergeData(data, name, this.configHandler.settings[name].dataConfig[label]);

							// save cache
							this.cache[name][label].values = mergedData.values;

							// serve clients that are connected to certain 'rooms'
							this.dataSocket.to(name + "__" + label).emit("update", mergedData);
						}
					}
				};

				this.dataFile[name][label] = new dataFileHandler({
					id: label,
					connection: this.configHandler.settings[name].connection[label],
					listener: listeners
				});

				this.dataFile[name][label].connect();
			}
		})
	}

	disconnect() {

		for (var name in this.dataFile) {
			for (var label in this.dataFile[name]) {
				this.dataFile[name][label].close();
				this.cache[name][label].clear();
				delete this.dataFile[name][label];
				delete this.cache[name][label];
			}
			delete this.dataFile[name];
			delete this.cache[name];
		}

		var sockets = this.dataSocket.connected;
		for (var id in sockets) {
			sockets[id].client.disconnect();
		};
		this.dataSocket.removeAllListeners(); // Remove all Listeners for the event emitter
		delete this.dataSocket;
		delete this.io.nsps['/data'];

		this.configHandler.unwatch();
	}

	// function initMailer(config) {
	//   /*
	//    * Init mailer
	//    */
	//   mailer.init({
	//     from: config.from, // sender address
	//     to: config.to, // list of receivers
	//     subject: config.subject
	//   });
	//   mailer.setType("html");
	//   mailer.setDelay(1000);
	// }
}

// Module exports
module.exports = dataModule;
