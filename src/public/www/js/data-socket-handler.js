// globals
var Selector = '[updatable]';

window.Content = {};
window.SvgSource = {};
window.maxValues = 5000; // 1h for every second update

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

  // Connect
  this.socket.on('connect', function() {
    console.info("client connected to: " + window.location.host);
  });
  // Init connection
  this.socket.on('initByServer', (function(settings) {
    if (this.opened === false) {
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
        this._loadSvgSources(settings.svg);
    } else {
      this.connect(window.selectedLabels);
    }
  }).bind(this));
  // Receive Data
  this.socket.on('initial', (function(message) {
    if (message !== undefined) {
      this._update(message);
      // select the MainPage
      window.PageSelector = document.querySelector('neon-animated-pages#PageSelector');
      window.PageSelector.select("1");
      // Set Window title to selectedLabels
      document.title = ((window.selectedLabels.length > 1) ? window.selectedLabels.join(', ') : window.selectedLabels.toString());
      this.opened = true;
    }
    else
      console.info("socket: received empty message");
    return;
  }).bind(this));
  // Receive Data
  this.socket.on('update', (function(message) {
    if (message)
      this._update(message);
    else
      console.info("socket: received empty message");
    return;
  }).bind(this));
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
DataSocketHandler.prototype = {
  constructor: DataSocketHandler,
  connect: function (labels) {
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
  },
  disconnect: function () {
    if (socket) {
      this.socket.disconnect();
      this.opened = false;
    }
  },
  _init: function () {
    this._getContentNodes();
  },
  _getContentNodes: function () {
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
  },
  _loadSvgSources: function (sources) {
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
  },
  _update: function (message) {
    if (Array.isArray(message)) // if message is an Array
      for (var i = 0; i < message.length; i++)
        this._updateContent(message[i]);
    else // if message is a single Object
      this._updateContent(message);
  },
  _updateContent: function (message) {
    if (!message.content)
      return;

    var label = message.label;
    var len, spliced;

    for (var id in message.content) {
      if (window.Content[label] === undefined || window.Content[label][id] === undefined) {
        console.warn("no Content-Object for", label, id); continue;
      }
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

      for (var j = 0; j < window.Content[label][id].nodes.length; j++) {
        window.Content[label][id].nodes[j].insertValues(message.content[id].values);
        if (spliced.length > 0)
          window.Content[label][id].nodes[j].spliceValues({start: 0, length: spliced.length, values: spliced});
      }

      // window.Content[label][id].database.last(console.log);
    }
    window.Content.Lakeshore.id1.database.last(( function(max) {
      console.log('x last', new Date(max.x));
    }).bind(this));
    window.Content.Lakeshore.id1.database.min(( function(max) {
      console.log('y min', max.y);
    }).bind(this), 'y');
    window.Content.Lakeshore.id1.database.first(( function(max) {
      console.log('x first', new Date(max.x));
    }).bind(this));
    window.Content.Lakeshore.id1.database.max(( function(max) {
      console.log('y max', max.y);
    }).bind(this), 'y');
  },
  compareFn: function (a, b) {
    if (a.x > b.x) return 1;
    if (a.x < b.x) return -1;
    return 0;
  }
}
