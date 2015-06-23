!function(){
  // Start of the Loading Process
  // (if the Client is ready)

  var data_processor = {"lastData": [], "lastMessage": 0, "lastMistake": 0, "lastError": 0, "lastExceeds": []};

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
      data_processor.lastExceeds = message.lastExceeds;

      var html = "";
      for (var i=0; i < data_processor.lastData.length; i++) {
        html += "<table><tr id=t"+i+"></tr>";
        $("#pm1").append(html);
        for (var j=0; j < 2000; j++) {
          html = "<tr>";
          html += "<td>"+j+"</td>"+"<td>"+data_processor.lastData[i].room+"</td>"+"<td>"+data_processor.lastData[i].kind+"</td>"+"<td>"+data_processor.lastData[i].method+"</td>";
          html += "</tr>";
          $("#t"+i).append(html);
        }
        html = "</table>";
      }
    });

    // Receive another Data
    dataSocket.on('data', function(message) {
      if(message === undefined) return; // Check for Existence

      data_processor.lastMessage = message.time;
      data_processor.lastData = message.content;
      data_processor.lastExceeds = message.lastExceeds;
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
