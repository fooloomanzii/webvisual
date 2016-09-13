// globals
var Selector = '[updatable]';
window.SvgSource = {};
window.maxValues = 1800; // 1/2h for every second update

// SOCKET
function DataSocketHandler(socketName, name, callwhenconnected) {
	this.opened = false;
	this.name = name;
	this.socketName = socketName;
	this.socket = io.connect('https://' + window.location.host + socketName, {
		secure: true,
		multiplex: false,
		query: "name=" + name
	});

	// Connect
	this.socket.on('connect', function() {
		console.info("client connected to: " + window.location.host);
	});
	// Init connection
	this.socket.on('initByServer', (function(settings) {
		if (this.opened === false) {
			window.Groups = settings.groups;
			window.GroupingKeys = settings.groupingKeys;
			window.PreferedGroupingKeys = settings.preferedGroupingKeys;
			window.Database = {};
			// window.Content = settings.elements;
			for (var label in window.Content) {
				var ids = Object.keys(window.Content[label]);
				window.Database[label] = {};
				for (var i in ids) {
					// window.Content[label][ids[i]].nodes = [];
					window.Database[label][ids[i]] = new DatabaseClient(this.name + '/' + label + '/' + ids[i]);
				}
			}
			if (settings.svg)
				this._loadSvgSources(settings.svg);
		} else {
			this.connect(window.selectedLabels);
		}
	}).bind(this));

	// Receive Data
	this.socket.on('initial', (function(message) {
		if (message !== undefined) {
			this._update(message);
			// Set Window title to selectedLabels
			document.title = ((window.selectedLabels.length > 1) ? window.selectedLabels.join(', ') : window.selectedLabels.toString());
			this.opened = true;
			// select the MainPage
			window.PageSelector = document.querySelector('neon-animated-pages#PageSelector');
			window.PageSelector.select("1");
		} else
			console.info("socket: received empty message");
		return;
	}).bind(this));
	// Receive Data
	this.socket.on('update', (function(message) {
		if (message)
			this._update(message);
		else
			console.info("socket: received empty message");
		return;
	}).bind(this));
	// Disconnect
	this.socket.on('disconnect', function() {
		console.warn("client disconnected to: " + window.location.host);
	});
	// Reconnect
	this.socket.on('reconnect', function() {
		console.info("client reconnected to: " + window.location.host);
	});
	// Disconnect
	this.socket.on('connect_error', function() {
		console.warn("error in connection to: " + window.location.host);
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
				// console.log("initByClient");
				// setTimeout( (function() {
				this.socket.emit('initByClient', {
						labels: labels
					})
					// }).bind(this), 500);
			}).bind(this));

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
			for (var i = 0; i < message.length; i++)
			this._updateContent(message[i]);
		else // if message is a single Object
			this._updateContent(message);
	},
	_updateContent: function(message) {
		if (!message.content)
			return;

		var label = message.label;
		var len, spliced, start1 = {},
			start2 = {};

		for (var id in message.content) {
			if (window.Content[label] === undefined || window.Content[label][id] === undefined) {
				console.warn("no window.Content-Object for", label, id);
				continue;
			}
			len = message.content[id].length;
			spliced = [];

			if (len > maxValues)
				message.content[id] = message.content[id].slice(len - maxValues, len);
			// console.log(len, label, id);
			// message.content[i].values.forEach(function(d) {
			//   d.x = Date.parse(d.x); // parse Date in Standard Date Object
			// });

			if (window.Content[label][id].values.length === 0)
				window.Content[label][id].values = message.content[id];
			else
				for (var j = message.content[id].length - 1; j >= 0; j--) {
					window.Content[label][id].values.push(message.content[id][j]);
				}
			if (window.Content[label][id].values.length > maxValues) {
				spliced = window.Content[label][id].values.splice(0, window.Content[label][id].values.length - maxValues);
			}

			start1[id] = new Date();
			window.Database[label][id].transaction('set', null, message.content[id])
				.then(function(result) {
					console.log("complete", label, id, "length:", message.content[id].length, "time:", new Date() - start1[id]);
				});

			for (var j = 0; j < window.Content[label][id].nodes.length; j++) {
				window.Content[label][id].nodes[j].insertValues(message.content[id]);
				if (spliced.length > 0)
					window.Content[label][id].nodes[j].spliceValues({
						start: 0,
						length: spliced.length,
						values: spliced
					});
			}
		}
	},
	compareFn: function(a, b) {
		if (a.x > b.x) return 1;
		if (a.x < b.x) return -1;
		return 0;
	}
}
