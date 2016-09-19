(function() {
	'use strict';
	var WORKER_URL = 'js/database-worker.js';
	var DB_NAME = 'database';
	var DB_STORAGE = 'entries';
	var DB_KEYPATH = 'x';
	var DB_INDEXKEYS = [{
		key: 'y',
		unique: false
	}, {
		key: 'state',
		unique: false
	}];

	function DatabaseClient(dbName, storeName, keyPath, indexKeys) {
		this.dbVersion = 1;
		this.dbName = dbName || DB_NAME;
		this.storeName = storeName || DB_STORAGE;
		this.messageId = 0;

		this.keyPath = keyPath || DB_KEYPATH;
		this.indexKeys = indexKeys || DB_INDEXKEYS;

		this.workerurl = WORKER_URL;
		this.isConnected = false;
		this.connectedWorker = null;

		this.connect();
	};

	DatabaseClient.prototype = {
		constructor: DatabaseClient,
		post: function(msg, buffer) {
			this.messageId++;
			return this.connect().then(function(worker) {
				return new Promise(function(resolve) {
					var id = this.messageId;
					worker.addEventListener('message', function onMessage(e) {
						if (e.data && e.data.id === id) {
							worker.removeEventListener('message', onMessage);
							resolve(e.data.result);
						}
					});
					msg.id = id;
					// console.log('postMessage', this.dbName, (+(new Date())));
					worker.postMessage(msg, buffer);
				}.bind(this));
			}.bind(this));
		},

		transaction: function(method, opt) {
			return this.post(
				JSON.stringify( {
					type: 'transaction',
					method: method,
					key: opt.key,
					value: opt.value,
					range: opt.range,
					direction: opt.direction,
					count: opt.count
				} ), opt.buffer);
		},

		close: function() {
			return this.post({
				type: 'close-db'
			});
		},

		connect: function() {
			if (this.isConnected || this.connectedWorker) {
				return this.connectedWorker;
			}
			return this.connectedWorker = new Promise(function(resolve) {
				var worker = new Worker(this.workerurl);
				worker.addEventListener('message', function(e) {
					if (e.data && e.data.type === 'db-connected') {
						console.log('IndexedDB Client connected!');
						this.isConnected = true;
						resolve(worker);
					}
				}.bind(this));

				worker.addEventListener('error', function(error) {
					console.error(error);
				});

				worker.postMessage({
					type: 'connect',
					args: {
						dbName: this.dbName,
						storeName: this.storeName,
						indexKeys: this.indexKeys,
						keyPath: this.keyPath
					}
				});
			}.bind(this));
		}
	}
	window.DatabaseClient = DatabaseClient;
})();
