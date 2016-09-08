// Local Database (IndexedDB)

window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
    IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;

var default_handler = {
  onerror: function(event) {
      console.log('Error IndexedDB', this.name, event.target.error);
  },
  ontransactionerror: function(event) {
      console.log('TransactionError IndexedDB', this.name, event.target.error);
  },
  onabort: function(event) {
      console.log("IndexedDB database aborted", this.name);
  },
  onopenabort: function(event) {
      console.log("IndexedDB database aborted while opening", this.name);
  },
  onsuccess: function(event) {
      console.log("Stored creating/accessing IndexedDB database successfully", this.name);
  },
  onblocked: function() {
    console.log("Your database version can't be upgraded because the app is open somewhere else.");
  }
}

function Database(label, id, sub, handler) {
  this.dbVersion = 1;
  this.name = label + "__" + id;
  this.handler = handler || default_handler;

  if (!Array.isArray(sub)) {
    if (sub === undefined)
      sub = "values";
    sub = [sub];
  }
  this.sub = sub;

  var request = window.indexedDB.open(this.name, this.dbVersion);
  request.onerror = this.handler.onerror;
  request.onsuccess = (function(event) {
      this.db = request.result;
      this.db.onerror = this.handler.onerror;
  }).bind(this);
  request.onupgradeneeded = (function(event) {
      this.db = request.result;
      this.db.onerror = this.handler.onerror;
      for (var i in this.sub) {
        var objectStore = this.db.createObjectStore(sub[i], { keyPath: "x" });
        objectStore.createIndex("y", "y", { unique: false });
        objectStore.createIndex("exceedingState", "exceedingState", { unique: false });
      }
  }).bind(this);
}

Database.prototype = {
  constructor: Database,
  add: function (value, sub, callback) {
    if (value === undefined) return;
    if (sub === undefined)
      sub = this.sub;
    else if (!Array.isArray(sub))
      sub = [sub];
    if (!Array.isArray(value))
      value = [value];
    if (callback === undefined)
      callback = function() {
        // console.log(this.name, value.length);
      }
    var tx = this.db.transaction(sub, "readwrite");

    // report on the success of opening the transaction
    tx.oncomplete = function () {
      callback(value);
    }
    tx.onerror = this.handler.ontransactionerror;

    // create an object store on the transaction
    for (var j in sub) {
      var objectStore = tx.objectStore(sub[j]);
      // add our newItem object to the object store
      var i = 0;
      addNext();
      function addNext() {
        if (i < value.length) {
            objectStore.add(value[i]).onsuccess = addNext;
            ++i;
            return;
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
  first: function (callback, sub) {
    this.search(callback, undefined, sub);
  },
  last: function (callback, sub) {
    this.search(callback, undefined, sub, "prevunique");
  },
  min: function (callback, index, sub) {
    this.search(callback, index, sub);
  },
  max: function (callback, index, sub) {
    this.search(callback, index, sub, "prevunique");
  },
  search: function (callback, index, sub, direction) {
    if (sub === undefined)
      sub = this.sub[0];
    else if (Array.isArray(sub))
      sub = sub[0];
    if (!Array.isArray(value))
      value = [value];
    if (callback === undefined)
      callback = function() {}

    var last;
    var tx = this.db.transaction(sub, "readwrite");
    // report on the success of opening the transaction
    tx.oncomplete = function () {
      callback(last);
    }
    tx.onerror = this.handler.ontransactionerror;

    if (!index)
      store = tx.objectStore(sub);
    else
      store = tx.objectStore(sub).index(index);
    var openCursorRequest = store.openCursor(null, direction);

    openCursorRequest.onsuccess = function (event) {
      last = event.target.result.value;
    }
  },
  count: function(callback, index, sub) {
    if (sub === undefined)
      sub = this.sub[0];
    else if (Array.isArray(sub))
      sub = sub[0];
    if (callback === undefined)
      callback = function() {
        // console.log(this.name, value.length);
      }

    var tx = this.db.transaction(sub, "readwrite");
    // report on the success of opening the transaction
    tx.oncomplete = this.handler.ontransactioncomplete;
    tx.onerror = this.handler.ontransactionerror;

    var store;
    if (!index)
      store = tx.objectStore(sub);
    else
      store = tx.objectStore(sub).index(index);

    var countRequest = store.count();
    countRequest.onsuccess = function() {
      callback(countRequest.result);
    }
    countRequest.onerror = function() {
      callback(undefined);
    }
  }
}
