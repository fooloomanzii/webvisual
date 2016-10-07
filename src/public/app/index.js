// 'use strict';

const {ipcRenderer} = require('electron');
var app;
var body;

window.addEventListener('WebComponentsReady', function(e) {

  app = document.querySelector('webvisual-app');

  ipcRenderer.on("log", function(e, msg) {
    app.log(msg);
  });

  ipcRenderer.on("event", function(e, event, arg) {
    app.eventHandler(event, arg);
  });

  ipcRenderer.send("event", "ready");
});
