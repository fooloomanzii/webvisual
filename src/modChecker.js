/*
 * Initial Check
 */
var modules=require('./package.json').dependencies;

function module_exists( name ) {
  try { return require.resolve( name ) }
  catch( e ) { return false }
}

for(var m in modules){
  if(!module_exists(m)){
		console.error("Some modules are not installed");
		process.exit(1);
  }
}

/*
 * Submodules check
 */
var fs = require('fs');
var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};
