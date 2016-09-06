// globals
var socketName = "/data";
var Request = "name=" + Name;
var Selector = '[updatable]';

var Content = {};
var SvgSource = {};
var Labels = [];
var GroupingKeys = {};
var PreferedGroupingKeys = {};
var maxValues = 50000; // 1h for every second update
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
  if (opened === false) {
    Labels = settings.labels;
    Groups = settings.groups;
    GroupingKeys = settings.groupingKeys;
    PreferedGroupingKeys = settings.preferedGroupingKeys;
    Content = settings.elements;
    for (var label in Content)
      for (var id in Content[label]) {
        Content[label][id].database = new Database(label, id);
        Content[label][id].nodes = [];
      }
    if (settings.svg)
      _loadSvgSources(settings.svg);
    if (Labels.length === 1)
      connect(Labels);
  } else {
    connect(Labels);
  }
});
// Receive Data
socket.on('initial', function(message) {
  if (message) {
    _update(message);
    // select the MainPage
    PageSelector.select("1");
    // Hide in MainPage the non selected label-related Elements
    MainPage.dissemblePanels(Labels);
    // Set Window title to selectedLabels
    document.title = ((Labels.length > 1) ? Labels.join(', ') : Labels.toString());
  }
  else
    console.info("socket: received empty message");
  return;
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
  setTimeout( function() {
    socket.emit('initByClient', {
      labels: Labels
    })
  }, 5000);
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
  _getContentNodes();
}

function _getContentNodes() {
  // grouping updatable Content in one Object
  if (Content === undefined)
    Content = {};
  var updatable = document.querySelectorAll(Selector);
  var label = '',
    id = '';
  for (var i = 0; i < updatable.length; i++) {
    label = updatable[i].getAttribute('label');
    id = updatable[i].getAttribute('id');
    if (label && id) {
      if (!Content[label])
        Content[label] = {};
      if (!Content[label][id])
        Content[label][id] = {nodes: [], values: [], database: new Database(label, id)};
      if (Content[label][id].nodes.indexOf(updatable[i]) === -1)
        Content[label][id].nodes.push(updatable[i]);
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
      this._updateContent(message[i], opened);
  else // if message is a single Object
    this._updateContent(message, opened);
  if (!opened) {
    // this.fire("loaded");
    opened = true;
    // console.log('loaded');
  }
}

function _updateContent(message, forceUpdate) {
  if (!message.content)
    return;

  var label = message.label;
  var id, len, spliced;

  for (var i = 0; i < message.content.length; i++) {
    id = message.content[i].id;
    len = message.content[i].values.length;
    spliced = [];

    if (len > maxValues)
      message.content[i].values = message.content[i].values.slice(len-maxValues, len);
    // console.log(len, label, id);
    // message.content[i].values.forEach(function(d) {
    //   d.x = Date.parse(d.x); // parse Date in Standard Date Object
    // });

    if (Content[label][id].values.length === 0)
      Content[label][id].values = message.content[i].values;
    else
      for (var j = message.content[i].values.length - 1; j >= 0 ; j--) {
        Content[label][id].values.push(message.content[i].values[j]);
      }
    if (Content[label][id].values.length > maxValues) {
      spliced = Content[label][id].values.splice(0, Content[label][id].values.length - maxValues);
    }

    Content[label][id].database.add(message.content[i].values);

    if (Content[label][id]) {
      for (var j = 0; j < Content[label][id].nodes.length; j++) {
        Content[label][id].nodes[j].insertValues(message.content[i].values);
        if (spliced.length > 0)
          Content[label][id].nodes[j].spliceValues({start: 0, length: spliced.length, values: spliced});
      }
    } else {
      console.warn("no Content for", label, id);
    }
  }
}

function compareFn(a, b) {
  if (a.x > b.x) return 1;
  if (a.x < b.x) return -1;
  return 0;
}
