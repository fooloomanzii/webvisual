(function(){
  var fs = require('fs'),
    parser = require('../modules/data_parser'),
    content = fs.readFileSync('test_data.txt', 'utf8'),
    lines = content.split('\r\n'); // Windows linebreak

  function callback(err, data) {
    if(err) {
      console.error("An error occured:", err);
    } else {
      console.log("\n\nData:", data);
    }
  }

  for(var i=0; i<lines.length-2; ++i) {
    parser.parse(lines[i], ',', callback);
  }

  parser.parse(lines[i++], ',', {format: ["date"]}, function(err, data) {
    if(err) {
      console.error("An error occured:", err);
    } else {
      console.log("\n\nData:", data);
    }
  });

  parser.parse(lines[i], ',', {format: []}, function(err, data) {
    if(err) {
      console.error("An error occured:", err);
    } else {
      console.log("\n\nData:", data);
    }
  });
})();