'use strict';

// void(function() {

const ipcRenderer = require('electron').ipcRenderer;
const remote = require('remote')
const Tray = remote.require('tray')
const Menu = remote.require('menu')
const MenuItem = remote.require('menu-item')
const dialog = remote.require('dialog');

function startServer() {
  ipcRenderer.send('server-start')
}

function stopServer() {
  ipcRenderer.send('server-stop')
}

function restartServer() {
  ipcRenderer.send('server-restart')
}

function quitApp() {
  ipcRenderer.send('app-quit')
}

// });
