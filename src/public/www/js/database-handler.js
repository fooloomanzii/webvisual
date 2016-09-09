// Local DatabaseHandler (IndexedDB)

window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
    IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;

var default_handler = {
  onerror: function(event) {
      console.log('Error IndexedDB', this.dbName, event.target.error);
  },
  ontransactionerror: function(event) {
      console.log('TransactionError IndexedDB', this.dbName, event.target.error);
  },
  onabort: function(event) {
      console.log("IndexedDB database aborted", this.dbName);
  },
  onopenabort: function(event) {
      console.log("IndexedDB database aborted while opening", this.dbName);
  },
  onsuccess: function(event) {
      console.log("Stored creating/accessing IndexedDB database successfully", this.dbName);
  },
  onblocked: function() {
    console.log("Your database version can't be upgraded because the app is open somewhere else.");
  }
}

function DatabaseHandler(name, label, ids, handler) {
  this.dbVersion = 1;
  this.dbName = name + "__" + label;
  this.handler = handler || default_handler;

  if (!Array.isArray(ids)) {
    if (ids === undefined)
      ids = "test";
    ids = [ids];
  }
  this.ids = ids;

  var request = window.indexedDB.open(this.dbName, this.dbVersion);
  request.onerror = this.handler.onerror;
  request.onsuccess = (function(event) {
      this.db = request.result;
      this.db.onerror = this.handler.onerror;
  }).bind(this);
  request.onupgradeneeded = (function(event) {
      this.db = request.result;
      this.db.onerror = this.handler.onerror;
      for (var i in this.ids) {
        var objectStore = this.db.createObjectStore(this.ids[i], { keyPath: "x" });
        objectStore.createIndex("y", "y", { unique: false });
        objectStore.createIndex("state", "state", { unique: false });
        objectStore.createIndex("exceeds", "exceeds", { unique: false });
      }
  }).bind(this);
}

DatabaseHandler.prototype = {
  constructor: DatabaseHandler,
  add: function (values, callback, doOverwrite) {
    if (values === undefined || Object.keys(values).length === 0) return;

    var tx = this.db.transaction(Object.keys(values), "readwrite");

    // complete transaction calls callback
    tx.oncomplete = function () {
      if (callback) callback(values);
    }
    tx.onerror = this.handler.ontransactionerror;

    // create an object store on the transaction
    for (var id in values) {
      var objectStore = tx.objectStore(id);
      // add our newItem object to the object store
      var i = 0;
      if (doOverwrite === true)
        putNext();
      else
        addNext();
      function addNext() {
        if (i < values[id].length) {
            objectStore.add(values[id][i]).onsuccess = addNext;
            ++i;
        }
      }
      function putNext() {
        if (i < values[id].length) {
            objectStore.put(values[id][i]).onsuccess = putNext;
            ++i;
        }
      }
    }
    // objectStoreRequest.onsuccess = callback.onsuccess;
  },
  remove: function (value) {},
  clear: function () {},
  values: function (key, start, end) {
      return;
  },
  // shorthand for looking at the edges of sorted indices
  first: function (callback, id) {
    this.lookAtEdge(callback, id, undefined, "next");
  },
  last: function (callback, id) {
    this.lookAtEdge(callback, id, undefined, "prev");
  },
  min: function (callback, id, key) {
    this.lookAtEdge(callback, id, key, "next");
  },
  max: function (callback, id, key) {
    this.lookAtEdge(callback, id, key, "prev");
  },
  lookAtEdge: function (callback, id, key, direction) {
    if (id === undefined) return;
    var last;
    var tx = this.db.transaction(id, "readonly");

    tx.oncomplete = function () {
      if (callback) callback(last);
    }
    tx.onerror = this.handler.ontransactionerror;

    if (!key)
      store = tx.objectStore(id);
    else
      store = tx.objectStore(id).index(key);
    var openCursorRequest = store.openCursor(null, direction);

    openCursorRequest.onsuccess = function (event) {
      last = event.target.result.value;
    }
  },
  count: function(callback, id, key) {
    if (id === undefined) return;

    var tx = this.db.transaction(id, "readonly");
    // report on the success of opening the transaction
    tx.oncomplete = this.handler.ontransactioncomplete;
    tx.onerror = this.handler.ontransactionerror;

    var store;
    if (!key)
      store = tx.objectStore(id);
    else
      store = tx.objectStore(id).index(key);

    var countRequest = store.count();
    countRequest.onsuccess = function() {
      if (callback) callback(countRequest.result);
    }
    countRequest.onerror = function() {
      if (callback) callback(undefined);
    }
  }
}
