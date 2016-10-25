'use strict';

	// Web Sockets
const ioServer = require('socket.io'),
	EventEmitter = require('events').EventEmitter,
	// Cache
	Cache = require('./cache'),
	// File Watch Module
	DataFileHandler = require('./filehandler').DataFileHandler,
	mergeData = require('./filehandler').DataMerge;

class DataModule extends EventEmitter {

	constructor(server, config) {
		super();
		this.io = new ioServer();
		this.cache = {};
		this.dataFiles = {};
    this.settings = {};

		if (server)
			this.setServer(server);

		if (config)
			this.setConfiguration(config);
	}

	setServer(server) {
		this.io.listen(server);

		// Handle connections of new clients
		this.dataSocket = this.io.of('/data');
		this.dataSocket.on('connection', (client) => {

			client.on('setup', (settings) => {
				var route = settings.route;
				if (settings) {
					client.compress(true).emit('init-by-server', this.settings[route].configuration);
				}
			});

			client.on('init-by-client', (config) => {
				const route = config.route
						, mobile = config.mobile
						, settings = this.settings[route];;
				let requestlast;

				for (let label of config.labels) {

					if (settings && settings.clientRequest[label] &&
							settings.clientRequest[label].initial) {
						if (mobile && settings.clientRequest[label].initial.mobile)
							requestlast = settings.clientRequest[label].initial.mobile;
						else if (!mobile && settings.clientRequest[label].initial.stationary)
							requestlast = settings.clientRequest[label].initial.stationary;
					}

					client.compress(true).emit('initial', {label: label, values: this.cache[route][label].request(requestlast)});

					client.join(route + '__' + label); // client joins room for selected label
				}
			});

			client.on('disconnect', (socket) => { });

			client.on('error', (err) => { });
		});

		this.io.of('/data').clients((err, clients) => {
			if (err) this.emit('error', 'socket.io', err)
		});
	}

	setConfiguration (settings, route) {
		this.settings[route] = settings;
		this.cache[route] = this.cache[route] || {};
		this.dataFiles[route] = this.dataFiles[route] || {};
		this.connect(route);
	}

	connect (route) {
		if (!route) return;

		// close prexisting connections and io-routespace(room)
		for (let label in this.dataFiles[route]) {
			this.dataFiles[route][label].close();
			delete this.dataFiles[route][label];
		}

		// DataFileHandler - established the data connections
		for (let label of this.settings[route].configuration.labels) {
			// create cache
			this.cache[route][label] = new Cache();
			// create callbacks for listeners of changes on files
			let listeners = {
				error: (option, err) => {
					let errString = '';
					err.forEach(function(msg) {
						errString += 'path: ' + msg.path + '\n' + msg.details + '\n';
					})
					this.emit('error', option.type + '\n' + errString);
				},
				data: (option, data, label) => {
					if (!data || data.length == 0)
						return; // Don't handle empty data
					// temporary save data
					if (this.settings[route] && this.settings[route].dataConfig[label]) {
						// process data
						let mergedData = mergeData(data, route, this.settings[route].dataConfig[label]);

						// save cache (on stack)
						this.cache[route][label].values = mergedData.values;

						// serve clients that are connected to certain 'rooms'
						this.dataSocket.to(route + '__' + label).emit('update', mergedData);
					}
				}
			};
			// create file watcher object
			this.dataFiles[route][label] = new DataFileHandler({
				id: label,
				connection: this.settings[route].connection[label],
				listener: listeners
			});
			// connect watcher
			this.dataFiles[route][label].connect();
		}
	}

	disconnect() {
		// disconnect watchers
		for (var route in this.dataFiles) {
			for (var label in this.dataFiles[route]) {
				this.dataFiles[route][label].close();
				this.cache[route][label].clear();
				delete this.dataFiles[route][label];
				delete this.cache[route][label];
			}
			delete this.dataFiles[route];
			delete this.cache[route];
		}

		// disconnect clients on sockets
		var sockets = this.dataSocket.connected;
		for (var id in sockets) {
			sockets[id].client.disconnect();
		};

		// remove all listeners on watchers and sockets of the event emitters
		this.dataSocket.removeAllListeners();
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
	//   mailer.setType('html');
	//   mailer.setDelay(1000);
	// }
}

// Module exports
module.exports = DataModule;
