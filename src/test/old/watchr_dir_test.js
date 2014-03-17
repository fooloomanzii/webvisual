var watchr = require('../modules/copywatch/node_modules/watchr'),
  fs = require('fs'),
  regex = /live_test.txt/i,
  files = fs.readdirSync(__dirname);

for(var i=0; i<files.length; ++i) {
  if(regex.test(files[i])) {
    delete files[i]; // Makes the value undefined
  }
}

watchr.watch({
  path: './',
  listener: function(type, path, currStat, prevStat) {
    console.log(path, "-", type);
  },
  ignoreHiddenFiles: true,
  ignorePaths: files
});