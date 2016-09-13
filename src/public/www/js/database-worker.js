(function() {
	'use strict';
	//
	// if (self && self.importScripts)
	//   self.importScripts('bluebird.min.js');
	// IndexedDBHandler

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

	function IndexedDBHandler(options) {

		this.dbVersion = DB_VERSION;
		this.dbName = options.dbName || DB_NAME;
		this.storeName = options.storeName || DB_STORAGE;

		this.keyPath = options.keyPath || DB_KEYPATH;
		this.indexKeys = options.indexKeys || DB_INDEXKEYS;

		this.open();
	}

	// IndexedDBHandler.prototype = {
	IndexedDBHandler.prototype = {
		open: function(dbVersion) {
			this.__dbOpenPromise = this.__dbOpenPromise || new Promise(function(resolve, reject) {
				var r = indexedDB.open(this.dbName, this.dbVersion);

				r.onupgradeneeded = r.onsuccess = function() {
					var existingStoreNames = r.result.objectStoreNames;
					if (existingStoreNames.contains(this.storeName) === false) {
						this.createObjectStore(r.result)
							.then(function() {
								resolve(r.result)
							});
					} else
						resolve(r.result);
				}.bind(this);

				r.onsuccess = function() {
					resolve(r.result);
				}.bind(this);

				r.onerror = function() {
					console.log('Could not open Database ', this.dbName, this.storeName)
					reject(r.error);
				}.bind(this);

			}.bind(this));

			return this.__dbOpenPromise;
		},

		createObjectStore: function(db) {
			return new Promise(function(resolve, reject) {
				try {
					console.log("createObjectStore", this.dbName, this.storeName)
					var objectStore = db.createObjectStore(this.storeName, {
						keyPath: this.keyPath
					});
					for (var i in this.indexKeys) {
						if (this.indexKeys[i].key)
							objectStore.createIndex(this.indexKeys[i].key, this.indexKeys[i].key, {
								unique: this.indexKeys[i].unique || false
							});
					}
				} catch (e) {
					return reject(e);
				}
				return resolve();
			}.bind(this));
		},

		close: function() {
			if (this.__dbOpenPromise == null) {
				return Promise.resolve();
			}

			return this.open().then(function(db) {
				this.__dbOpenPromise = null;
				db.close();
			}.bind(this));
		},

		get (key, value, count, range) {
			var rangeOptions, rangeMethod;
			if (value !== undefined) {
				rangeMethod = 'only';
				if (count === undefined) {
					count = 1;
				}
			}
			else if (range) {
				rangeMethod = range[0];
				rangeOptions = range.slice(1);
			}

			return this.open().then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], mode);
						if (!key)
							var s = t.objectStore(storeName);
						else
							var s = t.objectStore(storeName).index(key);
						var result = [],
								i = 0;
						var keyRange = IDBKeyRange[rangeMethod](rangeOptions);
						if ('getAllKeys' in objectStore) {
					    s.getAllKeys(keyRange, count).onsuccess = function(e) {
					      result = e.target.result;
					    };
					  } else {
					    s.openCursor(keyRange).onsuccess = function(e) {
					      var cursor = e.target.result;
								i++;
					      if (cursor && (count === undefined || i < count)) {
					        result.push(cursor.value);
					        cursor.continue();
					      }
					    };
						}
					} catch (e) {
						return reject(e);
					}

					t.oncomplete = function() {
						resolve(result);
					};
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		set(value) {
			var storeName = this.storeName;
			if (Array.isArray(value) === true) {
				return this.place(value);
			} else {
				return this.open().then(function(db) {
					return new Promise(function(resolve, reject) {
						try {
							var t = db.transaction([storeName], 'readwrite');
							var s = t.objectStore(storeName);
							s.put(value);
						} catch (e) {
							return reject(e);
						}
						t.oncomplete = function() {
							resolve();
						};
						t.onabort = t.onerror = function() {
							reject(t.error);
						};
					});
				});
			}
		},

		place(values) {
			var storeName = this.storeName;
			return this.open().then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readwrite');
						var s = t.objectStore(storeName);
						for (var i = 0; i < values.length; i++) {
							s.put(values[i]);
						}
					} catch (e) {
						return reject(e);
					}
					t.oncomplete = function() {
						resolve();
					};
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		count(key) {
			var storeName = this.storeName;
			return this.open().then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readonly');
						if (!key)
							var s = t.objectStore(this.storeName);
						else
							var s = t.objectStore(this.storeName).index(key);
						var r = s.count(value);
					} catch (e) {
						return reject(e);
					}
					t.oncomplete = function() {
						resolve(r.result);
					};
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		clear: function() {
			var storeName = this.storeName;
			return this.open().then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readwrite');
						var s = t.objectStore(this.storeName);
						s.count(value);
					} catch (e) {
						return reject(e);
					}
					t.oncomplete = function() {
						resolve();
					};
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		edge: function(key, count, direction) {
			return this.open().then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction(this.storeName, 'readonly');
						if (!key)
							var s = t.objectStore(this.storeName);
						else
							var s = t.objectStore(this.storeName).index(key);

						var result = [],
								i = 0;
						s.openCursor(null, direction).onsuccess = function(e) {
					    var cursor = e.target.result;
							i++;
				      if (cursor && (count === undefined || i < count)) {
				        result.push(cursor.value);
				        cursor.continue();
				      }
				    };

					} catch (e) {
						return reject(e);
					}

					r.onsuccess = function(e) {
						resolve(result);
					};
					t.onabort = function() {
						reject(t.error);
					};
				});
			});
		},

		transaction: function(method, key, value, range, count) {
			value = value || null;

			switch (method) {
				case 'get':
					return this.get(key, value, range, count);
					break;
				case 'set':
					return this.set(value);
					break;
				case 'first':
					return this.edge(key, count, 'prev');
					break;
				case 'last':
					return this.edge(key, count, 'next');
					break;
				case 'count':
					return this.count(key);
					break;
			}

			return Promise.reject(new Error('Method not supported: ' + method));
		},

		handleMessage: function(e) {
			if (!e.data) {
				return;
			}

			switch (e.data.type) {
				case 'close-db':
					this.closeDb().then(function() {
						postMessage({
							type: 'db-closed'
						});
					});
					break;
				case 'transaction':
					this.transaction(e.data.method, e.data.key, e.data.value, e.data.range, e.data.count)
						.then(function(result) {
							postMessage({
								type: 'transaction-result',
								result: result,
								start: e.data.start
							});
						});
					break;
			}
		}
	};
	if (self) {
		// acting as a webworker

		self.addEventListener(
			'unhandledrejection',
			function(error) {
				console.log("unhandledrejection", error);
			});
		self.addEventListener(
			'error',
			function(error) {
				console.log(error);
			});

		self.IndexedDBHandler = IndexedDBHandler;
		var databaseWorker;

		onmessage = function(e) {
			if (!e.data.type) {
				return;
			} else if (e.data.type === 'connect') {
				if (e.data.args === undefined) {
					console.log('No given arguments for creating a Database-Worker')
					return;
				}
				if (databaseWorker) {
					Promise.resolve(databaseWorker.close).then(function() {
						databaseWorker = new IndexedDBHandler(e.data.args);
						postMessage({
							type: 'db-connected'
						});
					})
				} else {
					databaseWorker = new IndexedDBHandler(e.data.args);
					postMessage({
						type: 'db-connected'
					});
				}
			} else if (databaseWorker.handleMessage)
				databaseWorker.handleMessage(e);
			else {
				console.log('Not possible', e)
			}
		};
	} else {
		// acting as a non-webworker (class)
		window.IndexedDBHandler = IndexedDBHandler;
	}
})();
