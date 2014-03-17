(function() {
  var fs = require('fs');
  var file = fs.openSync('test1_2012.09.05.txt', 'r');
  var buffer = new Buffer(128),
    offset = 0,
    length = buffer.length,
    position = null;

  var read;

  while((read = fs.readSync(file, buffer, offset, length, position))) {
    process.stdout.write( ((read < length) ? (buffer.slice(0, read)) : buffer).toString());
  }
})();