(function() {
  'use strict';

  // IndexedDBWorker

  var DB_NAME = 'database';
  var DB_STORAGE = 'entries';
  var DB_VERSION = 1;
  var DB_KEYPATH = 'x';
  var DB_INDEXKEYS = [
    {key: 'y', unique: false},
    {key: 'state', unique: false}
  ];

  var INTERNAL_STORE_NAME = 'internal';

  var MIGRATIONS = [
    // from this
    function(context) {
      var objectStore = context.database.createObjectStore(context.storeName, { keyPath: context.keyPath });
      for (var i in context.indexKeys) {
        if (context.indexKeys[i].key)
          objectStore.createIndex(context.indexKeys[i].key, context.indexKeys[i].key, { unique: context.indexKeys[i].unique || false });
      }
    },
    // to that
    function(context) {
      var objectStore = context.database.createObjectStore(INTERNAL_STORE_NAME, { keyPath: context.keyPath });
      for (var i in context.indexKeys) {
        if (context.indexKeys[i].key)
          objectStore.createIndex(context.indexKeys[i].key, context.indexKeys[i].key, { unique: context.indexKeys[i].unique || false });
      }
    }
  ];

  function IndexedDBWorker(dbName, storeName, keyPath, indexKeys) {
    this.dbVersion = 1;
    this.dbName = dbName || DB_NAME;
    this.storeName = storeName || DB_STORAGE;

    this.keyPath = keyPath || DB_KEYPATH;
    this.indexKeys = indexKeys || DB_INDEXKEYS;

    this.open();

    self.addEventListener(
        'unhandledrejection', function(error){ console.error(error); });
    self.addEventListener(
        'error', function(error) { console.error(error); });

    console.log('IndexedDBWorker started...');
  }

  IndexedDBWorker.prototype = {
    open: function() {
      this.__promise = this.__promise || new Promise(function(resolve, reject) {
        console.log('Opening database..');

        var r = indexedDB.open(this.dbName, DB_VERSION);

        r.onupgradeneeded = function(e) {
          console.log('Upgrade needed:', e.oldVersion, '=>', e.newVersion);
          var context = {
            database: r.result,
            storeName: this.storeName,
            dbName: this.dbName,
            keyPath: this.keyPath,
            indexKeys: this.indexKeys
          };

          for (var i = e.oldVersion; i < e.newVersion; ++i) {
            MIGRATIONS[i] && MIGRATIONS[i].call(this, context);
          }
        }.bind(this);

        r.onsuccess = function() {
          console.log('Database opened.');
          resolve(request.result);
        };
        r.onerror = function() {
          reject(request.error);
        };
      }.bind(this));

      return this.__promise;
    },

    close: function() {
      if (this.__promise == null) {
        return Promise.resolve();
      }

      return this.open().then(function(db) {
        this.__promise = null;
        console.log('Closing database..');
        db.close();
      }.bind(this));
    },

    get: function(storeName, key) {
      return this.operateOnStore('get', storeName, 'readonly', key);
    },

    set: function(storeName, key, value) {
      return this.operateOnStore('put', storeName, 'readwrite', value, key);
    },

    count: function(storeName, key) {
      return this.operateOnStore('count', storeName, 'readonly', key);
    },

    place: function (storeName, key, value) {
      var setOperations = [];
      for (var i in value) {
        setOperations.push(this.operateOnStore('put', storeName, 'readwrite', value, key));
      }
      return Promise.all(setOperations);
    },

    clear: function(storeName) {
      return this.operateOnStore('clear', storeName, 'readwrite');
    },

    operateOnStore: function(operation, storeName, mode) {
      var operationArgs = Array.from(arguments).slice(3);

      return this.open().then(function(db) {

        console.log('Store operation:', operation, storeName, mode);

        return new Promise(function(resolve, reject) {
          try {
            var t = db.transaction(storeName, mode);
            var s = t.objectStore(storeName);
            var r = s[operation].apply(store, operationArgs);
          } catch (e) {
            return reject(e);
          }

          t.oncomplete = function() { resolve(request.result); };
          t.onabort = function() { reject(transaction.error); };
        });
      });
    },

    edge: function(storeName, key, direction) {
      return this.operateByCursor(storeName, key, direction);
    },

    operateByCursor: function(storeName, key, direction) {
      var operationArgs = Array.from(arguments).slice(3);

      return this.open().then(function(db) {

        console.log('Cursor operation:', storeName, key, direction);

        return new Promise(function(resolve, reject) {
          try {
            var t = db.transaction(storeName, 'readonly');
            if (!key)
              var s = t.objectStore(storeName);
            else
              var s = t.objectStore(storeName).index(key);
            var r = s.openCursor(null, direction);
          } catch (e) {
            return reject(e);
          }

          r.onsuccess = function(e) { resolve(e.target.result.value); };
          t.onabort = function() { reject(transaction.error); };
        });
      });
    },

    transaction: function(method, key, value) {
      value = value || null;

      switch(method) {
        case 'get':
          return this.get(this.storeName, key);
        case 'set':
          return this.set(this.storeName, key, value);
        case 'place':
          return this.place(this.storeName, key, value);
        case 'first':
          return this.edge(this.storeName, key, 'prev');
        case 'last':
          return this.edge(this.storeName, key, 'next');
        // case 'setMin':
        //   return this.setEdge(this.storeName, key, 'prev');
        // case 'setMax':
        //   return this.setEdge(this.storeName, key, 'next');
        case 'count':
          return this.count(this.storeName, key);
      }

      return Promise.reject(new Error('Method not supported: ' + method));
    },

    handleMessage: function(e) {
      if (!e.data) {
        return;
      }

      var id = e.data.id;

      switch(e.data.type) {
        case 'close-db':
          this.closeDb().then(function() {
            postMessage({
              type: 'db-closed'
            });
          });
        case 'transaction':
          this.transaction(e.data.method, e.data.key, e.data.value)
              .then(function(result) {
                postMessage({
                  type: 'db-transaction-result',
                  result: result
                });
              });
          break;
      }
    }
  };

  var databaseWorker = {};

  onmessage = function(e) {
    if (!e.data.type) {
      return;
    }
    else if (e.data.type === 'connect') {
      if (e.args === undefined) {
        console.error('No given arguments for creating a Database-Worker')
        return;
      }
      if (databaseWorker.close) {
        Promise.resolve(databaseWorker.close).then(function(){
          databaseWorker = {};
          IndexedDBWorker.apply(databaseWorker, e.args);
          postMessage({
            type: 'db-connected'
          });
        })
        return;
      }
      databaseWorker = {};
      IndexedDBWorker.apply(databaseWorker, e.args);
      postMessage({
        type: 'db-connected'
      });
    }
    else if (databaseWorker.handleMessage)
      databaseWorker.handleMessage(e);
    else {
      console.error('Not possible', e)
    }
  };
})();
