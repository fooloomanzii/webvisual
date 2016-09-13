(function() {
	'use strict';
	var WORKER_URL = 'js/database-worker.js';
	var CONNECTS_TO_WORKER = '__connectsToWorker';
	var CONNECTED = '__connected';
	var MESSAGE_ID = '__messageId';
	var worker = null;

	var DB_NAME = 'database';
	var DB_STORAGE = 'entries';
	var DB_VERSION = 1;
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

		this.keyPath = keyPath || DB_KEYPATH;
		this.indexKeys = indexKeys || DB_INDEXKEYS;

		this.workerurl = WORKER_URL;
		this.isConnected = false;
		this.connectedWorker = null;
		this.connect();
	};

	DatabaseClient.prototype = {
		constructor: DatabaseClient,
		post: function(message) {
			return this.connect().then(function(worker) {
				return new Promise(function(resolve) {
					worker.addEventListener('message', function onMessage(event) {
						if (event) {
							worker.removeEventListener('message', onMessage);
							resolve(event.data.result);
						}
					});
					worker.postMessage(message);
				}.bind(this));
			}.bind(this));
		},

		transaction: function(method, key, value) {
			return this.post({
				type: 'transaction',
				method: method,
				key: key,
				value: value,
				start: new Date()
			});
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
				worker.addEventListener('message', function(event) {
					if (event.data && event.data.type === 'db-connected') {
						console.log('IndexedDB Client connected!');
						this.isConnected = true;
						resolve(worker);
					} else if (event.data && event.data.type === 'transaction-result') {
						// console.log('Transaction time:', new Date()-event.data.start);
						// resolve(worker);
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