(function(){
'use strict';

var fs     = require('fs'),
    path   = require('path'),
    config = require('../config/config.json');

/**
 * function: Route in Public Filesystem
 */
function route(route_path, json_obj) {
  json_obj.path = "/" + route_path;

  return function(req, res)
  {
    res.render(route_path, json_obj);
  };
}

/**
 * Routes
 */
// TODO: Preload through AJAX Custom-Element-Pages especially the Table

// Defaults
exports.index = route('index', { title: 'WebVisual' });

// External Logfile (file path from config.json)
exports.externalLogFile = function(req, res) {
  var filepath = path.resolve(__dirname + config.files.external_log.relative_path + config.files.external_log.file_name);
  res.sendfile(filepath);
};

// Data File        (file path from config.json)
exports.dataFile = function(req, res) {
  var filepath = path.resolve(__dirname + config.files.data.relative_path + config.files.data.file_name);
  res.sendfile(filepath);
};

})();


// // EXAMPLE of file routing
//
// // Tables
// // Locals
// var views    = path.join(__dirname, '../views'),
//   tables   = path.join(views, 'tables/tables'),
//   table404 = path.join(tables, '../404_table.jade');
//
// //Tables routing
// exports.table = function(req, res) {
//   var jadeOpt = {
//       path: req.url,
//       title: (config.locals&&config.locals.table&&config.locals.table.title)?
//           (config.locals.table.title):'Datatable'
//     },
//     jadeFile = path.join(tables, 'table')+'.jade';
//
//   // Deliver the specified table
//   if(req.query.type) {
//     // Modify the jadeFile
//     jadeFile = path.join(tables, req.query.type)+'.jade';
//
//     // Modify the jade object
//     jadeOpt.type = req.query.type;
//
//     // Check if the view exists, otherwise render a 404 message
//     if(!fs.existsSync(jadeFile)) {
//       res.status(404);
//       jadeFile = table404;
//     }
//   }
