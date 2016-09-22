// globals
var Selector = '[updatable]';
window.SvgSource = {};
window.maxValues = 5400; // 3/2h for every second update

// SOCKET
function DataSocketHandler(socketName, name, callwhenconnected) {
	this.opened = false;
	this.connected = false;
	this.name = name;
	this.socketName = socketName;
	this.socket = io.connect('https://' + window.location.host + socketName, {
		secure: true,
		multiplex: false
	});


	// Connect
	this.socket.on('connect', (function() {
			console.info("client connected to: " + window.location.host);
			this.connected = true;
			this.socket.emit('setup', {
				name: this.name
			})
		})
		.bind(this));

	// Init connection
	this.socket.on('init-by-server', (function(settings) {
			if (this.opened === false) {
				window.Groups = settings.groups;
				window.GroupingKeys = settings.groupingKeys;
				window.PreferedGroupingKeys = settings.preferedGroupingKeys;
				window.DatabaseForSocket = {};
				window.DatabaseForElements = {};
				window.Content = window.Content || settings.elements;
				window.Cache = {};
				for (var label in window.Content) {
					window.Cache[label] = new ClientCache(this.name, label);
					var ids = Object.keys(window.Content[label]);
					window.DatabaseForSocket[label] = {};
					for (var i in ids) {
						// window.Content[label][ids[i]].nodes = [];
						// window.DatabaseForSocket[label][ids[i]] = new DatabaseClient();
					}
				}
				if (settings.svg)
					this._loadSvgSources(settings.svg);
			} else {
				this.connect(window.selectedLabels);
			}
		})
		.bind(this));

	// Receive Data
	this.socket.on('initial', (function(message) {
			if (message !== undefined) {
				// Set Window title to selectedLabels
				this.opened = true;
				document.title = ((window.selectedLabels.length > 1) ? window.selectedLabels.join(', ') : window.selectedLabels.toString());
				createMessage('notification', "Connected to <i>" + this.name + "</i>: " + document.title, 3000);
				this._update(message);

				// select the MainPage
				window.PageSelector = document.querySelector('neon-animated-pages#PageSelector');
				window.PageSelector.select("1");
			} else
				console.info("socket: received empty message");
			return;
		})
		.bind(this));

	// Receive Data
	this.socket.on('update', (function(message) {
			if (message)
				this._update(message);
			else
				console.info("socket: received empty message");
			return;
		})
		.bind(this));

	// Disconnect (Reload if discoonected)
	this.socket.on('disconnect', function() {
		console.warn("client disconnected to: " + window.location.host);
		createMessage('error', "Disconnected to <i>" + this.name + "</i>", 3000);
		this.connected = false;
		var restart = setInterval( function() {
			if (this.connected === true) {
				clearInterval(restart);
			} else {
				window.location.reload()
			}
		}, 30000);
	}.bind(this));

	// Reconnect
	this.socket.on('reconnect', function() {
		console.info("client reconnected to: " + window.location.host);
		this.connected = true;
		createMessage('notification', "Client reconnected", 3000);
	}.bind(this));

	// Error
	this.socket.on('connect_error', function() {
		console.warn("error in connection to: " + window.location.host);
		createMessage('error', 'An error occured in the connection to the data server');
	});

	this.socket.on('error', function() {
		console.warn("server error by: " + window.location.host);
		createMessage('error', 'There is no connection possible to the data-server. Please try again later');
	});
}

// MESSAGE HANDLING
DataSocketHandler.prototype = {
	constructor: DataSocketHandler,
	connect: function(labels) {
		// send Config
		if (!labels || labels.length === 0) {
			console.warn("No labels set for connection");
			return;
		}
		this._init()
			.then((function() {
					this.socket.emit('init-by-client', {
							name: this.name,
							labels: labels,
							mobile: window.isMobile
						})
				})
				.bind(this));

	},
	disconnect: function() {
		if (socket) {
			this.socket.disconnect();
			this.opened = false;
		}
	},
	_init: function() {
		// grouping updatable window.Content in one Object
		return new Promise(function(resolve, reject) {
			// if (window.Content === undefined)
			//   window.Content = {};
			var updatable = document.querySelectorAll(Selector);
			var label = '',
				id = '',
				pos,
				i = 0;
			while (true) {
				label = updatable[i].getAttribute('label');
				id = updatable[i].getAttribute('id');
				if (label && id) {
					if (window.Content === undefined)
						window.Content = {};
					if (window.Content[label] === undefined)
						window.Content[label] = {};
					if (window.Content[label][id] === undefined)
						window.Content[label][id] = {
							nodes: [],
							values: []
						};
					if ((pos = window.Content[label][id].nodes.indexOf(updatable[i])) === -1) {
						window.Content[label][id].nodes.push(updatable[i]);
					}
				}
				i++;
				if (i === updatable.length) {
					resolve();
				}
			}
		})
	},
	_loadSvgSources: function(sources) {
		var xhttp = [];
		var req;
		for (var label in sources) {
			for (var id in sources[label]) {
				// import svg
				// prevents multible reloading after creation time
				if (!sources[label][id].src || (SvgSource[id] && SvgSource[id].src && SvgSource[id].src === sources[label][id].src))
					continue;
				window.SvgSource[id] = {
					selectable: sources[label][id].selectable,
					src: sources[label][id].src
				};
				req = new XMLHttpRequest();
				req.onreadystatechange = function(index) {
					if (this.readyState === 4 && this.status === 200) {
						window.SvgSource[index].node = this.responseXML.documentElement;
					}
				}.bind(req, id);
				req.open("GET", sources[label][id].src, true);
				req.send();
				xhttp.push(req);
			}
		}
	},
	_update: function(message) {
		if (Array.isArray(message)) // if message is an Array
			for (var i = 0; i < message.length; i++) {
			this._updateCache(message[i]);
			this._updateContent(message[i]);
			// this._updateDatabase(message[i]);
		}
		else { // if message is a single Object
			this._updateCache(message);
			this._updateContent(message);
			// this._updateDatabase(message);
		}
	},

	_updateDatabase: function(message) {
		var label = message.label;
		for (var id in message.values) {
			window.DatabaseForSocket[label][id].transaction(label + "/" + id, id, 'set', {
				value: message.values[id]
			});
		}
	},
	_updateCache: function(message) {
		var label = message.label;
		window.Cache[label].append(message.values);
	},

	_updateContent: function(message) {
		if (!message.values)
			return;

		var label = message.label;
		var len, spliced, start1 = {},
			start2 = {}, splices = [], heap = [];

		for (var id in message.values) {
			if (window.Content[label] === undefined || window.Content[label][id] === undefined) {
				console.warn("no window.Content-Object for", label, id);
				continue;
			}
			len = message.values[id].length;


			// if (len > maxValues)
			// 	message.values[id] = message.values[id].slice(len - maxValues, len);
			// // console.log(len, label, id);
			// // message.values[i].values.forEach(function(d) {
			// //   d.x = Date.parse(d.x); // parse Date in Standard Date Object
			// // });
			//
			// if (window.Content[label][id].values.length === 0)
			// 	window.Content[label][id].values = message.values[id];
			// else
			// 	for (var j = 0; j < message.values[id].length; j++) {
			// 		window.Content[label][id].values.push(message.values[id][j]);
			// 	}
			// if (window.Content[label][id].values.length > maxValues) {
			// 	spliced = window.Content[label][id].values.splice(0, window.Content[label][id].values.length - maxValues);
			// }

			// start1[id] = new Date();
			// window.DatabaseForSocket[label][id].transaction(label+"/"+id, id, 'set', {value: message.values[id]});
			// .then(function(result) {
			// 	console.log("set", label, id, "length:", message.values[id].length, "time:", new Date() - start1[id]);
			// });
			// start2[id] = new Date();
			// window.DatabaseForSocket[label][id].transaction('setBuffer', {
			// 		value: message.buffer[id],
			// 		buffer: [message.buffer[id].x, message.buffer[id].y]
			// 	})
			// 	.then(function(result) {
			// 		console.log("setBuffer", label, id, "length:", message.values[id].length, "time:", new Date() - start2[id]);
			// 		start1[id] = new Date();
			// 		window.DatabaseForSocket[label][id].transaction('get', {key: 'y', range: ['lowerBound',1.569983]})
			// 			.then(function(result) {
			// 				console.log("get", label, id, "time:", new Date() - start1[id]);
			// 				console.log(JSON.stringify(result));
			// 			});
			// 		window.DatabaseForElements[label][id].transaction('first', {key: 'y', count:20})
			// 			.then(function(result) {
			// 				console.log("first", label, id, "time:", new Date() - start1[id]);
			// 				console.log(JSON.stringify(result));
			// 			});
			// 	});
			// setTimeout(function(){
			// 	start1[id] = new Date();
			// 	window.DatabaseForElements[label][id].transaction('last', {count: 10})
			// 		.then(function(result) {
			// 			console.log("last", label, id, "time:", new Date() - start1[id]);
			// 			console.log(result);
			// 		});
			// }, 10000);
			splices = window.Cache[label][id].splices;
			heap = window.Cache[label][id].heap;
			for (var j = 0; j < window.Content[label][id].nodes.length; j++) {
				window.Content[label][id].nodes[j].insertValues(heap);
				window.Content[label][id].nodes[j].spliceValues(splices);
			}
			splices.length = 0;
			heap.length = 0;
		}
	},
	compareFn: function(a, b) {
		if (a.x > b.x) return 1;
		if (a.x < b.x) return -1;
		return 0;
	}
}
