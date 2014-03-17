(function(){
  var fs = require('fs');
  var file = 'test.txt';
  var changeOnce = true;


  fs.watch(file, function(event, filename) {
    /*  HACK!
      The whole callback just executes every second time.
      The watch-method fires two change-events when the
      watched file was changed once. */
    if(changeOnce)
    {
      if(event == 'change') {
        console.log("\n\nData in the file was changed. New Data:\n");
        process.stdout.write(fs.readFileSync(file, {encoding: 'utf8'}));
      } else if(event == 'rename' && filename) {
        file = filename;
      }
    }

    changeOnce = !changeOnce;
  });
})();