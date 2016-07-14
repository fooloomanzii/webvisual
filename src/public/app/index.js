// 'use strict';

const {ipcRenderer} = require('electron');
var app;
var body;

  ipcRenderer.on("log", function(e, msg) {
    if (!body)
       body = document.querySelector('section#log section#body');
    let row = document.createElement('section');
    row.id = "tr";
    row.classList.add("style-scope");
    row.classList.add("webvisual-app");
    let date = document.createElement('section');
    date.id = "td"; date.className = "date";
    date.classList.add("style-scope");
    date.classList.add("webvisual-app");
    let timestamp = new Date();
    date.innerHTML = timestamp.toLocaleDateString() + '<br/>' + timestamp.toLocaleTimeString() + "." + timestamp.getMilliseconds();
    let message = document.createElement('section');
    message.id = "td"; message.className = "msg";
    message.classList.add("style-scope");
    message.classList.add("webvisual-app");
    message.textContent = msg;
    row.appendChild(date); row.appendChild(message);
    body.insertBefore(row, body.childNodes[0]);
  });

  ipcRenderer.on("event", function(e, event, arg) {
    app = document.querySelector('webvisual-app');
    app.eventHandler(event, arg);
  });
