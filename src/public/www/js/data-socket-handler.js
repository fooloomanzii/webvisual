// globals
var Selector = '[updatable]';

window.Content = {};
window.SvgSource = {};
window.maxValues = 50000; // 1h for every second update

// SOCKET
function DataSocketHandler(socketName, name) {
  this.opened = false;
  this.name = name;
  this.socketName = socketName;
  this.socket = io.connect('https://' + window.location.host + socketName, {
    secure: true,
    multiplex: false,
    query: "name=" + name
  });

  var self = this;

  // Connect
  this.socket.on('connect', function() {
    console.info("client connected to: " + window.location.host);
  });
  // Init connection
  this.socket.on('initByServer', function(settings) {
    if (self.opened === false) {
      window.Groups = settings.groups;
      window.GroupingKeys = settings.groupingKeys;
      window.PreferedGroupingKeys = settings.preferedGroupingKeys;
      window.Content = settings.elements;
      for (var label in window.Content)
        for (var id in window.Content[label]) {
          window.Content[label][id].database = new Database(label, id);
          window.Content[label][id].nodes = [];
        }
      if (settings.svg)
        self._loadSvgSources(settings.svg);
    } else {
      self.connect(window.selectedLabels);
    }
  });
  // Receive Data
  this.socket.on('initial', function(message) {
    if (message) {
      self._update(message);
      // select the MainPage
      window.PageSelector = document.querySelector('neon-animated-pages#PageSelector');
      window.PageSelector.select("1");
      // Set Window title to selectedLabels
      document.title = ((window.selectedLabels.length > 1) ? window.selectedLabels.join(', ') : window.selectedLabels.toString());
      self.opened = true;
    }
    else
      console.info("socket: received empty message");
    return;
  });
  // Receive Data
  this.socket.on('update', function(message) {
    if (message)
      self._update(message);
    else
      console.info("socket: received empty message");
    return;
  });
  // Disconnect
  this.socket.on('disconnect', function() {
    console.warn("client disconnected to: " + window.location.host);
  });
  // Reconnect
  this.socket.on('reconnect', function() {
    console.info("client reconnected to: " + window.location.host);
  });
  // Disconnect
  this.socket.on('connect_error', function() {
    console.warn("error in connection to: " + window.location.host);
  });
}

// MESSAGE HANDLING
DataSocketHandler.prototype.connect = function connect(labels) {
  // send Config
  if (!labels || labels.length === 0) {
    console.warn("No labels set for connection");
    return;
  }
  this._init();
  // setTimeout( function() {
    this.socket.emit('initByClient', {
      labels: labels
    })
  // }, 5000);
}

DataSocketHandler.prototype.disconnect = function disconnect() {
  if (socket) {
    this.socket.disconnect();
    this.opened = false;
  }
}

DataSocketHandler.prototype._init = function _init() {
  this._getContentNodes();
}

DataSocketHandler.prototype._getContentNodes = function _getContentNodes() {
  // grouping updatable window.Content in one Object
  if (window.Content === undefined)
    window.Content = {};
  var updatable = document.querySelectorAll(Selector);
  var label = '',
    id = '';
  for (var i = 0; i < updatable.length; i++) {
    label = updatable[i].getAttribute('label');
    id = updatable[i].getAttribute('id');
    if (label && id) {
      if (!window.Content[label])
        window.Content[label] = {};
      if (!window.Content[label][id])
        window.Content[label][id] = {nodes: [], values: [], database: new Database(label, id)};
      if (window.Content[label][id].nodes.indexOf(updatable[i]) === -1)
        window.Content[label][id].nodes.push(updatable[i]);
    }
  }
  updatable.length = 0;
}

DataSocketHandler.prototype._loadSvgSources = function _loadSvgSources(sources) {
  var xhttp = [];
  var req;
  for (var label in sources) {
    for (var id in sources[label]) {
      // import svg
      // prevents multible reloading after creation time
      if (!sources[label][id].src || (SvgSource[id] && SvgSource[id].src && SvgSource[id].src === sources[label][id].src))
        continue;
      window.SvgSource[id] = {
        selectable: sources[label][id].selectable,
        src: sources[label][id].src
      };
      req = new XMLHttpRequest();
      req.onreadystatechange = function(index) {
        if (this.readyState === 4 && this.status === 200) {
          window.SvgSource[index].node = this.responseXML.documentElement;
        }
      }.bind(req, id);
      req.open("GET", sources[label][id].src, true);
      req.send();
      xhttp.push(req);
    }
  }
}

DataSocketHandler.prototype._update = function _update(message) {
  if (Array.isArray(message)) // if message is an Array
    for (var i = 0; i < message.length; i++)
      this._updateContent(message[i]);
  else // if message is a single Object
    this._updateContent(message);
}

DataSocketHandler.prototype._updateContent = function _updateContent(message) {
  if (!message.content)
    return;

  var label = message.label;
  var len, spliced;

  for (var id in message.content) {
    len = message.content[id].values.length;
    spliced = [];

    if (len > maxValues)
      message.content[id].values = message.content[id].values.slice(len-maxValues, len);
    // console.log(len, label, id);
    // message.content[i].values.forEach(function(d) {
    //   d.x = Date.parse(d.x); // parse Date in Standard Date Object
    // });

    if (window.Content[label][id].values.length === 0)
      window.Content[label][id].values = message.content[id].values;
    else
      for (var j = message.content[id].values.length - 1; j >= 0 ; j--) {
        window.Content[label][id].values.push(message.content[id].values[j]);
      }
    if (window.Content[label][id].values.length > maxValues) {
      spliced = window.Content[label][id].values.splice(0, window.Content[label][id].values.length - maxValues);
    }

    window.Content[label][id].database.add(message.content[id].values);

    if (window.Content[label][id]) {
      for (var j = 0; j < window.Content[label][id].nodes.length; j++) {
        window.Content[label][id].nodes[j].insertValues(message.content[id].values);
        if (spliced.length > 0)
          window.Content[label][id].nodes[j].spliceValues({start: 0, length: spliced.length, values: spliced});
      }
    } else {
      console.warn("no window.Content for", label, id);
    }
  }
}

DataSocketHandler.prototype.compareFn = function compareFn(a, b) {
  if (a.x > b.x) return 1;
  if (a.x < b.x) return -1;
  return 0;
}
