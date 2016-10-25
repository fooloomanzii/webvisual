(function() {
	'use strict';
	//
	// IndexedDBHandler

	var DB_KEYPATH = 'x';
	var DB_INDEXKEYS = [{
		key: 'y',
		unique: false
	}, {
		key: 'state',
		unique: false
	}];

	function IndexedDBHandler(opt) {
		this.keyPath = opt.keyPath || DB_KEYPATH;
		this.indexKeys = opt.indexKeys || DB_INDEXKEYS;

		this.__dbOpenPromise = null;

	}

	// IndexedDBHandler.prototype = {
	IndexedDBHandler.prototype = {
		open: function(dbName, storeName, dbVersion) {

			return new Promise(function(resolve, reject) {

				var r = indexedDB.open(dbName, dbVersion);

				r.onsuccess = function(e) {
					var db = e.target.result;
					var existingstoreNames = db.objectStoreNames;
					var version = parseInt(db.version) || 0;
					// console.log(dbName, storeName, version);
					if (existingstoreNames.contains(storeName))
						resolve(db);
					else {
						db.close();
						this.open(dbName, storeName, version + 1)
								.then(function(db) {
									resolve(db);
								})
					}
				}.bind(this);

				r.onupgradeneeded = function(e) {
					var db = e.target.result;
					console.log(db, dbName, storeName);
					this.createObjectStore(db, dbName, storeName)
							.then(function(db) {
								resolve(db);
							});
				}.bind(this);

				r.onerror = function(e) {
					console.log('Could not open Database ', dbName, storeName, dbVersion)
					reject(r.error);
				}.bind(this);

			}.bind(this));
		},

		createObjectStore: function(db, dbName, storeName) {
			return new Promise( function(resolve, reject) {
				try {
					console.log("createObjectStore", dbName, storeName)
					var objectStore = db.createObjectStore(storeName, {
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
				return resolve(db);
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

		get: function(dbName, storeName, key, value, range, count) {
			var rangeOptions = null,
				rangeMethod = null,
				keyRange = null;
			if (value !== null) {
				rangeMethod = 'only';
				rangeOptions = value;
				if (count === undefined) {
					count = 1;
				}
			} else if (range) {
				rangeMethod = range[0];
				rangeOptions = range.slice(1);
			}
			console.log(range, rangeMethod, rangeOptions);
			if (rangeMethod) {
				keyRange = IDBKeyRange[rangeMethod].apply(this, rangeOptions);
			}

			return this.open(dbName, storeName).then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readonly');
						if (!key)
							var s = t.objectStore(storeName);
						else
							var s = t.objectStore(storeName).index(key);
						var result = [],
							i = 0;

						if (keyRange && 'getAllKeys' in s) {
							s.getAllKeys(keyRange, count).onsuccess = function(e) {
								resolve(e.target.result);
							};
						} else {
							s.openCursor(keyRange, 'prev').onsuccess = function(e) {
								var cursor = e.target.result;
								i++;
								if (cursor && (count === undefined || i < count)) {
									result.push(cursor.value);
									cursor.continue();
								} else {
									resolve(result);
								}
							};
						}
					} catch (e) {
						return reject(e);
					}

					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		set: function(dbName, storeName, value) {
			if (Array.isArray(value) === true) {
				return this.place(dbName, storeName, value);
			} else {
				return this.open(dbName, storeName).then(function(db) {
					return new Promise(function(resolve, reject) {
						try {
							var t = db.transaction([storeName], 'readwrite');
							var s = t.objectStore(storeName);
							var r = s.put(value);
							r.onsuccess = function() {
								resolve();
							}
						} catch (e) {
							return reject(e);
						}
						t.onabort = t.onerror = function() {
							reject(t.error);
						};
					});
				});
			}
		},
		place: function(dbName, storeName, values) {
			return this.open(dbName, storeName).then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readwrite');
						var s = t.objectStore(storeName);
						for (var i = values.length - 1 ; i >=0 ; i--) {
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

		setBuffer: function(dbName, storeName, buffer) {
			var floatArrays = {
				x: new Float64Array(buffer.x),
				y: new Float64Array(buffer.y)
			};
			return this.open(dbName, storeName).then(function(db) {
				console.log('start Promise', new Date());
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readwrite');
						var s = t.objectStore(storeName);
						var r;
						for (var i = 0; i < floatArrays.x.length; i++) {
							r = s.put({
								x: floatArrays.x[i],
								y: floatArrays.y[i] || null
							});
							if (i === floatArrays.x.length - 1) {
								console.log('possible end Promise', new Date());
								resolve();
							}
						}
					} catch (e) {
						return reject(e);
					}
					// t.oncomplete = function() {
					// 	console.log('end Promise', new Date());
					// 	resolve();
					// };
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		count: function(dbName, storeName, key) {
			return this.open(dbName, storeName).then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readonly');
						if (!key)
							var s = t.objectStore(storeName);
						else
							var s = t.objectStore(storeName).index(key);
						var r = s.count();
						r.onsuccess = function() {
							resolve(r.result);
						}
					} catch (e) {
						return reject(e);
					}
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		clear: function(dbName, storeName) {
			return this.open(dbName, storeName).then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction([storeName], 'readwrite');
						var s = t.objectStore(storeName);
						var r = s.clear();
						r.onsuccess = function() {
							resolve();
						}
					} catch (e) {
						return reject(e);
					}
					t.onabort = t.onerror = function() {
						reject(t.error);
					};
				});
			});
		},

		edge: function(dbName, storeName, key, count, direction) {
			return this.open(dbName, storeName).then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction(storeName, 'readonly');
						if (!key)
							var s = t.objectStore(storeName);
						else
							var s = t.objectStore(storeName).index(key);

						var result = [],
							cursor,
							i = 0;
						s.openCursor(null, direction).onsuccess = function(e) {
							cursor = e.target.result;
							i++;
							if ((i <= count || count === undefined) && cursor) {
								result.push(cursor.value);
								cursor.continue();
							} else {
								resolve(result)
							}
						};
					} catch (e) {
						return reject(e);
					}
					t.onabort = function() {
						reject(t.error);
					};
				});
			});
		},

		range: function(dbName, storeName, key) {
			var keyPath = key || this.keyPath;
			return this.open(dbName, storeName).then(function(db) {
				return new Promise(function(resolve, reject) {
					try {
						var t = db.transaction(storeName, 'readonly');
						if (!key)
							var s = t.objectStore(storeName);
						else
							var s = t.objectStore(storeName).index(key);

						var result = [],
							i = 0;
						s.openCursor(null, 'next').onsuccess = function(e) {
							result.push(e.target.result.value[keyPath]);
						};
						s.openCursor(null, 'prev').onsuccess = function(e) {
							result.push(e.target.result.value[keyPath]);
						};

					} catch (e) {
						return reject(e);
					}

					t.oncomplete = function(e) {
						resolve(result);
					};
					t.onabort = function() {
						reject(t.error);
					};
				});
			});
		},

		transaction: function(opt) {
			opt.value = opt.value || null;
			var dbName = opt.dbName;
			var storeName = opt.storeName;

			switch (opt.method) {
				case 'get':
					return this.get(dbName, storeName, opt.key, opt.value, opt.range, opt.count || 1);
					break;
				case 'set':
					return this.set(dbName, storeName, opt.value);
					break;
				case 'setBuffer':
					return this.setBuffer(dbName, storeName, opt.value);
					break;
				case 'first':
					return this.edge(dbName, storeName, opt.key, opt.count || 1, 'next');
					break;
				case 'last':
					return this.edge(dbName, storeName, opt.key, opt.count || 1, 'prev');
					break;
				case 'edge':
					return this.edge(dbName, storeName, opt.key, opt.count || 1, opt.dierection || 'prevUnique');
					break;
				case 'count':
					return this.count(dbName, storeName, opt.key);
					break;
				case 'range':
					return this.range(dbName, storeName, opt.key);
					break;
			}

			return Promise.reject(new Error('Method not supported: ' + method));
		},

		handleMessage: function(data) {
			if (!data) {
				return;
			}
			var id = data.id;

			switch (data.type) {
				case 'close-db':
					this.closeDb().then(function() {
						postMessage({
							type: 'db-closed'
						});
					});
					break;
				case 'transaction':
					this.transaction(data)
						.then(function(result) {
							postMessage({
								type: 'transaction-result',
								id: id,
								result: result
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
			var message = JSON.parse(e.data) || {};
			if (message.type === 'connect') {
				if (databaseWorker) {
					Promise.resolve(databaseWorker.close).then(function() {
						databaseWorker = new IndexedDBHandler(message.args);
						postMessage({
							type: 'db-connected'
						});
					})
				} else {
					databaseWorker = new IndexedDBHandler(message.args);
					postMessage({
						type: 'db-connected'
					});
				}
			} else if (databaseWorker && databaseWorker.handleMessage) {
				// console.log('onMessage', message.dbName, (+(new Date())));
				databaseWorker.handleMessage(message);
			} else {
				console.log('Not possible', message)
			}
		};
	} else {
		// acting as a non-webworker (class)
		// window.IndexedDBHandler = IndexedDBHandler;
	}
})();
