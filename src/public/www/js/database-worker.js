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

  function IndexedDBWorker (options) {
    DB_VERSION++;
    this.dbVersion = DB_VERSION;
    this.dbName = options.dbName || DB_NAME;
    this.storeName = options.storeName || DB_STORAGE;

    this.keyPath = options.keyPath || DB_KEYPATH;
    this.indexKeys = options.indexKeys || DB_INDEXKEYS;

    this.open();
    log('IndexedDBWorker started...');
  }

  // IndexedDBWorker.prototype = {
  IndexedDBWorker.prototype = {
    open: function () {
      this.__promise = this.__promise || new Promise(function(resolve, reject) {
        // log('Opening database..');

        var r = indexedDB.open(this.dbName, this.dbVersion);

        r.onupgradeneeded = (function(e) {
          // log('Upgrade needed:', e.oldVersion, '=>', e.newVersion);
          var context = {
            database: r.result,
            storeName: this.storeName,
            dbName: this.dbName,
            keyPath: this.keyPath,
            indexKeys: this.indexKeys
          };

          var objectStore = context.database.createObjectStore(context.storeName, { keyPath: context.keyPath });
          for (var i in context.indexKeys) {
            if (context.indexKeys[i].key)
              objectStore.createIndex(context.indexKeys[i].key, context.indexKeys[i].key, { unique: context.indexKeys[i].unique || false });
          }
          // for (var i = e.oldVersion; i < e.newVersion; ++i) {
          //   MIGRATIONS[i] && MIGRATIONS[i].call(this, context);
          // }
        }).bind(this);

        r.onsuccess = function() {
          log('Database opened. ' + this.dbName + ' ' + this.storeName);
          resolve(r.result);
        }.bind(this);
        r.onerror = function() {
          errorlog('Could not open Database ' + this.dbName + ' ' + this.storeName)
          reject(r.error);
        }.bind(this);
        return this.__promise;
      }.bind(this));

      return this.__promise;
    },

    close: function () {
      if (this.__promise == null) {
        return Promise.resolve();
      }

      return this.open().then(function(db) {
        this.__promise = null;
        // log('Closing database..');
        db.close();
      }.bind(this));
    },

    get (key) {
      return this.operateOnStore('get', 'readonly', key);
    },

    set (key, value) {
      return this.operateOnStore('put', 'readwrite', key, value);
    },

    count (key) {
      return this.operateOnStore('count', 'readonly', key);
    },

    place (key, value) {
      var setOperations = [];
      var storeName = this.storeName;
      for (var i in value) {
        setOperations.push(this.operateOnStore('put', 'readwrite', key, value));
      }
      return Promise.all(setOperations);
    },

    clear: function () {
      return this.operateOnStore('clear', 'readwrite');
    },

    operateOnStore: function (operation, mode, key, value) {
      var operationArgs = Array.from(arguments).slice(3);
      var storeName = this.storeName;
      return this.open().then(function(db) {

        log(['Store operation:', operation, mode]);

        return new Promise(function(resolve, reject) {
          try {
            var t = db.transaction([storeName], mode);
            if (!key)
              var s = t.objectStore(storeName);
            else
              var s = t.objectStore(storeName).index(key);
            var r = s[operation](value);
          } catch (e) {
            return reject(e);
          }

          t.oncomplete = function() { resolve(r.result); };
          t.onabort = t.onerror = function() { reject(transaction.error); };
        });
      });
    },

    edge: function (key, direction) {
      return this.operateByCursor(key, direction);
    },

    operateByCursor: function (key, direction) {
      var operationArgs = Array.from(arguments).slice(2);

      return this.open().then(function(db) {

        log('Cursor operation:', this.storeName, key, direction);

        return new Promise(function(resolve, reject) {
          try {
            var t = db.transaction(this.storeName, 'readonly');
            if (!key)
              var s = t.objectStore(this.storeName);
            else
              var s = t.objectStore(this.storeName).index(key);
            var r = s.openCursor(null, direction);
          } catch (e) {
            return reject(e);
          }

          r.onsuccess = function(e) { resolve(e.target.result.value); };
          t.onabort = function() { reject(transaction.error); };
        });
      });
    },

    transaction: function (method, key, value) {
      value = value || null;

      log(method, key, value);

      switch(method) {
        case 'get':
          return this.get(key);
        case 'set':
          return this.set(key, value);
        case 'place':
          return this.place(key, value);
        case 'first':
          return this.edge(key, 'prev');
        case 'last':
          return this.edge(key, 'next');
        // case 'setMin':
        //   return this.setEdge(this.storeName, key, 'prev');
        // case 'setMax':
        //   return this.setEdge(this.storeName, key, 'next');
        case 'count':
          return this.count(key);
      }

      return Promise.reject(new Error('Method not supported: ' + method));
    },

    handleMessage: function (e) {
      if (!e.data) {
        return;
      }

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
                  type: 'transaction-result',
                  result: result
                });
              });
          break;
      }
    }
  };

  function log(args) {
    postMessage({
      type: 'log',
      msg: JSON.stringify(args)
    })
  }
  function errorlog(args) {
    postMessage({
      type: 'error',
      msg: JSON.stringify(args)
    })
  }

  self.addEventListener(
      'unhandledrejection', function(error){ log({type: "unhandledrejection", error: error}); });
  self.addEventListener(
      'error', function(error) { errorlog(error); });

  self.IndexedDBWorker = IndexedDBWorker;
  var databaseWorker;

  onmessage = function(e) {
    log(e);
    if (!e.data.type) {
      return;
    }
    else if (e.data.type === 'connect') {
      if (e.data.args === undefined) {
        log('No given arguments for creating a Database-Worker')
        return;
      }
      if (databaseWorker) {
        Promise.resolve(databaseWorker.close).then(function(){
          databaseWorker = new IndexedDBWorker(e.data.args);
          postMessage({
            type: 'db-connected'
          });
        })
        return;
      }
      databaseWorker = new IndexedDBWorker(e.data.args);
      postMessage({
        type: 'db-connected'
      });
    }
    else if (databaseWorker.handleMessage)
      databaseWorker.handleMessage(e);
    else {
      log('Not possible', e)
    }
  };
})();
