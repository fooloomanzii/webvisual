// 'use strict';

const {ipcRenderer} = require('electron');
// const remote = require('remote')
// const Tray = remote.require('tray')
// const Menu = remote.require('menu')
// const MenuItem = remote.require('menu-item')
// const dialog = remote.require('dialog');

var body;

ipcRenderer.on("log", function(e, msg) {
  if (!body)
     body = document.querySelector('section#log section#body');
  let row = document.createElement('section');
  row.id = "tr";
  let date = document.createElement('section');
  date.id = "td"; date.className = "date";
  let timestamp = new Date();
  date.textContent = timestamp.toLocaleString() + "." + timestamp.getMilliseconds();
  let message = document.createElement('section');
  message.id = "td"; message.className = "msg";
  message.textContent = msg;
  row.appendChild(date); row.appendChild(message);
  body.insertBefore(row, body.childNodes[0]);
});

function startServer() {
  ipcRenderer.send('server-start');
}

function stopServer() {
  ipcRenderer.send('server-stop');
}

function restartServer() {
  ipcRenderer.send('server-restart');
}

function quitApp() {
  ipcRenderer.send('app-quit');
}

function openClientView() {
  ipcRenderer.send('open-client-view');
}
