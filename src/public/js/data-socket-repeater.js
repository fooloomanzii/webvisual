// globals
var socketName = "/data";
var Selector = "[updatable]";
var Nodes = {};
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
  multiplex: false
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
  _getNodes();
}

function _getNodes() {
  // grouping updatable Nodes in one Object
  Nodes = {};
  var updatable = document.querySelectorAll(Selector);
  var label = '',
    id = '';
  for (var i = 0; i < updatable.length; i++) {
    label = updatable[i].getAttribute('label');
    id = updatable[i].getAttribute('id');
    if (label && id) {
      if (!Nodes[label])
        Nodes[label] = {};
      if (!Nodes[label][id])
        Nodes[label][id] = [];
      Nodes[label][id].push(updatable[i]);
    }
  }
  updatable.length = 0;
}

function _loadSvgSources(sources) {
  var xhttp = [];
  var req;
  for (var id in sources) {
    // import svg
    // prevents multible reloading after creation time
    SvgSource[id] = {
      selectable: sources[id].selectable
    };
    req = new XMLHttpRequest();
    req.onreadystatechange = function(name) {
      if (this.readyState === 4 && this.status === 200) {
        SvgSource[name].node = this.responseXML.documentElement;
      }
    }.bind(req, id);
    req.open("GET", sources[id].src, true);
    req.send();
    xhttp.push(req);
  }
}

function _update(message) {
  if (Array.isArray(message)) // if message is an Array
    for (var mesId = 0; mesId < message.length; mesId++)
      this._updateNodes(message[mesId]);
  else // if message is a single Object
    this._updateNodes(message);
  if (!this.opened) {
    // this.fire("loaded");
    this.opened = true;
  }
}

function _updateNodes(message) {
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
    if (Nodes[label][id]) {
      for (var j = 0; j < Nodes[label][id].length; j++) {
        if (!doAppend)
          Nodes[label][id][j].spliceValues(0, message.content[i].values.length);
        if (newestDataLast) {
          for (var k = 0; k < message.content[i].values.length; k++) {
            Nodes[label][id][j].unshiftValues(message.content[i].values[k]);
          }
        } else {
          for (var k = message.content[i].values.length - 1; k >= 0; k--) {
            Nodes[label][id][j].unshiftValues(message.content[i].values[k]);
          }
        }
        if (Nodes[label][id][j].values.length > maxValues)
          Nodes[label][id][j].spliceValues(maxValues, Nodes[label][id][j].values.length - maxValues);
      }
    } else {
      console.warn("no Nodes for", label, id);
    }
  }
}