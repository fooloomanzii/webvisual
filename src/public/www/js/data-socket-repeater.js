// globals
var socketName = "/data";
var Request = "name=" + Name;
var Selector = '[updatable]';
var Values = {};
var UpdatableNodes = {};
var Elements = {};
var SvgSource = {};
var Labels = [];
var AvailableLabels = [];
var GroupingKeys = {};
var PreferedGroupingKeys = {};
var maxValues = 100; // 1h for every second update
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
socket.on('initByServer', function(settings) {
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
  socket.emit('initByClient', {
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
    for (var i = 0; i < message.length; i++)
      this._updateUpdatableNodes(message[i], opened);
  else // if message is a single Object
    this._updateUpdatableNodes(message, opened);
  if (!opened) {
    // this.fire("loaded");
    opened = true;
    // console.log('loaded');
  }
}

function _updateUpdatableNodes(message, forceUpdate) {
  if (!message.content)
    return;

  var label = message.label;
  var id, len;

  if (!Values[label])
    Values[label] = {};

  for (var i = 0; i < message.content.length; i++) {
    id = message.content[i].id;
    len = message.content[i].values.length;

    if (len > maxValues)
      message.content[i].values = message.content[i].values.slice(len-maxValues, len);
    // console.log(len, label, id);
    // message.content[i].values.forEach(function(d) {
    //   d.x = Date.parse(d.x); // parse Date in Standard Date Object
    // });

    if (!Values[label][id])
      Values[label][id] = message.content[i].values;
    else
      for (var j = message.content[i].values.length - 1; j >= 0 ; j--) {
        Values[label][id].push(message.content[i].values[j]);
      }
    // if (Values[label][id].length > maxValues)
    //   Values[label][id] = Values[label][id].splice(0, Values[label][id].length - maxValues);

    // if (UpdatableNodes[label][id]) {
    //   for (var j = 0; j < UpdatableNodes[label][id].length; j++) {
    //     UpdatableNodes[label][id][j].insertValues(message.content[i].values);
    //     // if (UpdatableNodes[label][id][j].values.length > maxValues)
    //     //   UpdatableNodes[label][id][j].spliceValues(0, UpdatableNodes[label][id][j].values.length - maxValues);
    //   }
    // } else {
    //   console.warn("no UpdatableNodes for", label, id);
    // }
  }
}

function compareFn(a, b) {
  if (a.x > b.x) return 1;
  if (a.x < b.x) return -1;
  return 0;
}
