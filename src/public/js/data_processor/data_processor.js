!function(){
  // Start of the Loading Process
  // (if the Client is ready)

  var data_processor = {"lastData": [],
                        "lastMessage": "",
                        "lastMistake": "",
                        "lastError": "",
                        "lastExceeds": [],
                        "socket": "/data",
                        "doAppend": true,
                        "maxTotalLines": 5,
                        "groups": {}};

  window.data_processor = data_processor;

  $(document).ready(function() {
    var self = data_processor;
    var dataSocket = io.connect('https://'+window.location.host+self.socket, {secure: true});
    // Receiving the first Data
    dataSocket.on('first', function(message) {
      if(message === undefined || message.content === undefined) return; // Check the Existence

      self.lastMessage = message.time;

      self.lastData = message.content;
      for (var i=0; i < message.content.length; i++) {
        self.lastData[i].data = message.content[i].data.slice(-self.maxTotalLines);
      }
      self.lastExceeds = message.lastExceeds;
      self.groups = message.groups;
    });

    // Receive another Data
    dataSocket.on('data', function(message) {
      if(message === undefined || message.content === undefined) return; // Check for Existence

      self.lastMessage = null;
      self.lastExceeds = null;
      self.lastMessage = message.time;
      self.lastExceeds = message.lastExceeds;

      var k = 0;

      if (self.doAppend){
          for (var i=0; i < self.lastData.length; i++) {
            while (message.content[i].data.length + self.lastData[i].data.length > self.maxTotalLines && self.lastData[i].data.length > 0)
              self.lastData[i].data.shift();
            k = 0;
            if (message.content[i].data.length > self.maxTotalLines)
              k = message.content[i].data.length - self.maxTotalLines;
            for (var j=k; j < message.content[i].data.length; j++) {
              self.lastData[i].data.push(message.content[i].data[j]);
            }
          }
      }
      else {
        for (var i=0; i < self.lastData.length; i++) {
          self.lastData[i].data = [];
          var k = 0;
          if (message.content[i].data.length > self.maxTotalLines)
            k = message.content[i].data.length - self.maxTotalLines;
          for (var j=k; j < message.content[i].data.length; j++) {
            self.lastData[i].data.push(message.content[i].data[j]);
          }
        }
      }
    });

    //*** Wrong Data
    dataSocket.on('mistake', function(message) {
      self.lastMistake = message.time;
      self.lastError = message.error;
    });

    // var event = new CustomEvent("dataLoaded", { "detail": lastData });
    // document.dispatchEvent(event);
  });

}();
