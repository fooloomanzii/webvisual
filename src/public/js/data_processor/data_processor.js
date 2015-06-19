(function(){
  // Start of the Loading Process
  // (if the Client is ready)

  var lastMessage = "",
      lastData = [],
      lastMistake = "",
      lastError = "";

  $(document).ready(function() {

    var dataSocket = io.connect('https://'+window.location.host+'/data', {secure: true});
    // Receiving the first Data
    dataSocket.on('first', function(message) {
      if(message === undefined) return; // Check the Existence

      lastMessage = message.time;
      lastData = message.content;
    });

    // Receive another Data
    dataSocket.on('data', function(message) {
      if(message === undefined) return; // Check for Existence

      lastMessage = message.time;
      lastData = message.content;
    });

    //*** Wrong Data
    dataSocket.on('mistake', function(message) {
      lastMistake = message.time;
      lastError = message.error;
    });

    // var event = new CustomEvent("dataLoaded", { "detail": lastData });
    // document.dispatchEvent(event);
  });

})();
