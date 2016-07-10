// globals
var socketName = "/data";
var Request = "name=" + Name;
var Selector = '[updatable]';
var UpdatableNodes = {};
var Elements = {};
var SvgSource = {};
var Labels = [];
var AvailableLabels = [];
var GroupingKeys = {};
var PreferedGroupingKeys = {};
var maxValues = 5400; // 1.5h for every second update
var doAppend = true;
var newestDataLast = true;
var isExceeding = false;
var opened = false;

// SOCKET
var socket = io.connect('https://' + window.location.host + socketName, {
  secure: true,
  multiplex: false,
  query: Request
});

// Connect
socket.on('connect', function() {
  console.info("client connected to: " + window.location.host);
});
// Init connection
socket.on('init', function(settings) {
  if (!opened) {
    Labels = settings.labels;
    Groups = settings.groups;
    Elements = settings.elements;
    GroupingKeys = settings.groupingKeys;
    PreferedGroupingKeys = settings.preferedGroupingKeys;
    if (settings.svg)
      _loadSvgSources(settings.svg);
  } else {
    connect(Labels);
  }
});
// Receive Data
socket.on('update', function(message) {
  if (message)
    _update(message);
  else
    console.info("socket: received empty message");
  return;
});
// Disconnect
socket.on('disconnect', function() {
  console.warn("client disconnected to: " + window.location.host);
});
// Reconnect
socket.on('reconnect', function() {
  console.info("client reconnected to: " + window.location.host);
});
// Disconnect
socket.on('connect_error', function() {
  console.warn("error in connection to: " + window.location.host);
});

// MESSAGE HANDLING
function connect(labels) {
  // send Config
  if (!labels || labels.length === 0) {
    console.warn("No labels set for connection");
    return;
  }
  Labels = labels;
  _init();
  socket.emit('init', {
    labels: Labels
  });
}

function reconnect() {
  socket.disconnect();
  socket = io.connect('https://' + window.location.host + socketName, {
    secure: true,
    multiplex: false
  });
}

function disconnect() {
  if (socket) {
    socket.disconnect();
    opened = false;
  }
}

function _init() {
  _getUpdatableNodes();
}

function _getUpdatableNodes() {
  // grouping updatable UpdatableNodes in one Object
  UpdatableNodes = {};
  var updatable = document.querySelectorAll(Selector);
  var label = '',
    id = '';
  for (var i = 0; i < updatable.length; i++) {
    label = updatable[i].getAttribute('label');
    id = updatable[i].getAttribute('id');
    if (label && id) {
      if (!UpdatableNodes[label])
        UpdatableNodes[label] = {};
      if (!UpdatableNodes[label][id])
        UpdatableNodes[label][id] = [];
      if (UpdatableNodes[label][id].indexOf(updatable[i]) === -1)
        UpdatableNodes[label][id].push(updatable[i]);
    }
  }
  updatable.length = 0;
}

function _loadSvgSources(sources) {
  var xhttp = [];
  var req;
  for (var label in sources) {
    for (var id in sources[label]) {
      // import svg
      // prevents multible reloading after creation time
      if (!sources[label][id].src || (SvgSource[id] && SvgSource[id].src && SvgSource[id].src === sources[label][id].src))
        continue;
      SvgSource[id] = {
        selectable: sources[label][id].selectable,
        src: sources[label][id].src
      };
      req = new XMLHttpRequest();
      req.onreadystatechange = function(name) {
        if (this.readyState === 4 && this.status === 200) {
          SvgSource[name].node = this.responseXML.documentElement;
        }
      }.bind(req, id);
      req.open("GET", sources[label][id].src, true);
      req.send();
      xhttp.push(req);
    }
  }
}

function _update(message) {
  if (Array.isArray(message)) // if message is an Array
    for (var mesId = 0; mesId < message.length; mesId++)
      this._updateUpdatableNodes(message[mesId]);
  else // if message is a single Object
    this._updateUpdatableNodes(message);
  if (!this.opened) {
    // this.fire("loaded");
    this.opened = true;
  }
}

function _updateUpdatableNodes(message) {
  if (!message.content)
    return;

  var label = message.label;
  var id;

  //
  // .splice(1, 1, {name: 'Sam'}); this.items.push({name: 'Bob'}); this.notifySplices('items', [ { index: 1, removed: [{name: 'Todd'}], addedCount: 1, obect: this.items, type: 'splice' }, { index: 3, removed: [], addedCount: 1, object: this.items, type: 'splice'} ]);
  for (var i = 0; i < message.content.length; i++) {
    id = message.content[i].id;
    message.content[i].values.forEach(function(d) {
      d.x = Date.parse(d.x); // parse Date in Standard Date Object
    });
    if (UpdatableNodes[label][id]) {
      for (var j = 0; j < UpdatableNodes[label][id].length; j++) {
        if (!doAppend)
          UpdatableNodes[label][id][j].spliceValues(0, message.content[i].values.length);
        if (newestDataLast) {
          for (var k = 0; k < message.content[i].values.length; k++) {
            UpdatableNodes[label][id][j].unshiftValues(message.content[i].values[k]);
          }
        } else {
          for (var k = message.content[i].values.length - 1; k >= 0; k--) {
            UpdatableNodes[label][id][j].unshiftValues(message.content[i].values[k]);
          }
        }
        if (UpdatableNodes[label][id][j].values.length > maxValues)
          UpdatableNodes[label][id][j].spliceValues(maxValues, UpdatableNodes[label][id][j].values.length - maxValues);
      }
    } else {
      console.warn("no UpdatableNodes for", label, id);
    }
  }
}
