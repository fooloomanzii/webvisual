// globals
var svgSource = {};
var socketName = "/data";
var selector = "[updatable]";
var config = { "label": "" };
var elements = {};
var labels = [];
var availableLabels = [];
var groupingKeys = {};
var preferedGroupingKeys = {};
var maxTotalLines = 100;
var maxLines = this.maxTotalLines;
var doAppend = true;
var newestDataLast= true;
var isExceeding = false;
var opened = false;


// SOCKET
var socket = io.connect('https://'+window.location.host+socketName, {secure: true, multiplex: false});

// Connect
socket.on('connect', function() {
  console.info("client connected to: "+window.location.host);
});
// Init connection
socket.on('init', function(settings) {
  availableLabels = settings.labels;
  if (!opened) {
    groupingKeys = settings.groupingKeys;
    preferedGroupingKeys = settings.preferedGroupingKeys;
    if (settings.svg)
      _loadSvgSources(settings.svg);
  }
  else {
    connect();
  }
});
// Receive Data
socket.on('update', function(message) {
  if(message)
    _update(message);
  else
    console.warn("socket: received empty message");
  return;
});
// Disconnect
socket.on('disconnect', function() {
  console.warn("client disconnected to: "+window.location.host);
});
// Reconnect
socket.on('reconnect', function() {
  console.info("client reconnected to: "+window.location.host);
});
// Disconnect
socket.on('connect_error', function() {
  console.warn("error in connection to: "+window.location.host);
});

// MESSAGE HANDLING
function connect() {
  // send Config
  var settings = { labels: ["HNF-GDS","test"] };
  socket.emit('init', settings);
  _init();
}

function reconnect() {
  socket.disconnect();
  socket = io.connect('https://'+window.location.host+socketName, {secure: true, multiplex: false});
  socket.on('clientConfig', function(message) {
    availableLabels = message.labels;
    connect();
  });
}

function disconnect() {
  if (socket){
    socket.disconnect();
    opened = false;
  }
}

function _init() {
  _getElements();
}

function _getElements() {
  // grouping updatable Elements in one Object
  elements = {};
  var updatable = document.querySelectorAll(selector);
  var label = '', id = '';
  for (var i=0; i < updatable.length; i++) {
    label = updatable[i].getAttribute('label');
    id = updatable[i].getAttribute('id');
    if (!elements[label])
      elements[label] = {};
    if (!elements[label][id])
      elements[label][id] = [];
    elements[label][id].push(updatable[i]);
  }
  updatable.length = 0;
}

function _loadSvgSources(sources) {
  var xhttp = [];
  var req;
  for (var id in sources) {
    // import svg
    // prevents multible reloading after creation time
    svgSource[id] = {selectable: sources[id].selectable};
    req = new XMLHttpRequest();
    req.onreadystatechange = function(name) {
        if (this.readyState === 4 && this.status === 200) {
          svgSource[name].node = this.responseXML.documentElement;
        }
    }.bind(req, id);
    req.open("GET", sources[id].src, true);
    req.send();
    xhttp.push(req);
  }
}

function _update(message) {
  if (Array.isArray(message)) // if message is an Array
    for (var mesId=0; mesId < message.length; mesId++)
      this._updateElements(message[mesId]);
  else  // if message is a single Object
    this._updateElements(message);
  if (!this.opened ) {
    // this.fire("loaded");
    this.opened = true;
  }
}

function _updateElements(message) {
  if(!message.content)
    return;

  var label = message.label;
  var id;

  for (var i=0; i < message.content.length; i++) {
    id = message.content[i].id;
    if (elements[label][id]) {
      for (var j=0; j < elements[label][id].length; j++) {
        if (!doAppend)
          elements[label][id][j].spliceValues(0, values.length);
        if (newestDataLast) {
          for (var k = 0; k < message.content[i].values.length; k++) {
            elements[label][id][j].unshiftValues(message.content[i].values[k]);
          }
        }
        else {
          for (var k = message.content[i].values.length-1; k >=0; k--) {
            elements[label][id][j].unshiftValues(message.content[i].values[k]);
          }
        }
        if (elements[label][id][j].values.length > maxLines)
          elements[label][id][j].spliceValues(maxLines, elements[label][id][j].values.length - maxLines);
        }
      }
      else {
        console.warn("no elements for",label,id);
      }
    }
  // if (messageContent.lastExceeds)
  //   this.set('groups.' + labelindex + '.groups.' + a + '.subgroup.' + b + '.elements.' + c + '.values', messageContent.lastExceeds);
}
