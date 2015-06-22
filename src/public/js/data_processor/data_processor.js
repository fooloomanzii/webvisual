!function(){
  // Start of the Loading Process
  // (if the Client is ready)

  var data_processor = {"lastData": [], "lastMessage": 0, "lastMistake": 0, "lastError": 0};

  data_processor.update = function() {
    data_processor.lastMessage = data_processor.lastMessage;
  }

  $(document).ready(function() {

    var dataSocket = io.connect('https://'+window.location.host+'/data', {secure: true});
    // Receiving the first Data
    dataSocket.on('first', function(message) {
      if(message === undefined) return; // Check the Existence

      data_processor.lastMessage = message.time;
      data_processor.lastData = message.content;
    });

    // Receive another Data
    dataSocket.on('data', function(message) {
      if(message === undefined) return; // Check for Existence

      data_processor.lastMessage = message.time;
      data_processor.lastData = message.content;
    });

    //*** Wrong Data
    dataSocket.on('mistake', function(message) {
      data_processor.lastMistake = message.time;
      data_processor.lastError = message.error;
    });

    // var event = new CustomEvent("dataLoaded", { "detail": lastData });
    // document.dispatchEvent(event);
  });

  this.data_processor = data_processor;

}();
