// Local Database (IndexedDB)

window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB,
    IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;

var default_callback = {
  onerror: function(event) {
      // console.log("Error creating/accessing IndexedDB database", event.target.error);
  },
  oncomplete: function(event) {
      // console.log("Transaction IndexedDB database complete");
  },
  onsuccess: function(event) {
      // console.log("Stored creating/accessing IndexedDB database successfully");
  }
}

class Database {
  constructor(label, id, sub) {
    this.dbVersion = 1;
    this.name = label + "__" + id;

    if (!Array.isArray(sub)) {
      if (sub === undefined)
        sub = "values";
      sub = [sub];
    }
    this.sub = sub;

    var request = indexedDB.open(this.name, this.dbVersion);
    request.onblocked = default_callback.onerror;
    request.onabort = default_callback.onerror;
    request.onsuccess = (function(event) {
        this.db = request.result;
        this.db.onerror = default_callback.onerror;
        this.db.onabort = default_callback.onerror;
    }).bind(this);
    request.onupgradeneeded = (function(event) {
        this.db = request.result;
        this.db.onerror = default_callback.onerror;
        this.db.onabort = default_callback.onerror;
        for (var i in this.sub) {
          var objectStore = this.db.createObjectStore(sub[i], { keyPath: "x" });
          objectStore.createIndex("y", "y", { unique: false });
          objectStore.createIndex("exceeds", "exceeds", { unique: false });
        }
    }).bind(this);
  }

  add (value, sub, callback = default_callback) {
    if (!Array.isArray(sub)) {
      if (sub === undefined)
        sub = "values";
      sub = [sub];
    }
    var transaction = this.db.transaction(sub, "readwrite");

    // report on the success of opening the transaction
    transaction.oncomplete = callback.oncomplete;
    transaction.onerror = callback.onerror;

    // create an object store on the transaction
    for (var j in sub) {
      var objectStore = transaction.objectStore(sub[j]);

      // add our newItem object to the object store
      if (Array.isArray(value)) {
        for (var i in value)
          objectStore.add(value[i]);
      }
      else
        objectStore.add(value);
    }
    // objectStoreRequest.onsuccess = callback.onsuccess;
  }

  remove (value) {}

  clear() {}

  values(key, start, end) {
      return;
  }

  last() {
      return;
  }

  first() {
      return;
  }

  max() {
      return;
  }

  min() {
      return;
  }

  createObjectStore(database) {
      // Create an objectStore
      console.log("Creating objectStore");
      database.createObjectStore(this.name);
  }
}
