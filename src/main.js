"use strict";

require("events").EventEmitter.prototype._maxListeners = 0;
var electron = require("electron");
var remote = require("electron").remote;
const {ipcMain} = require("electron");
var shell = require("electron").shell;
var util = require("util");

var app = electron.app; // Module to control application life.
var BrowserWindow = electron.BrowserWindow; // Module to create native browser window.
const {dialog} = require("electron");

var fs = require("fs"),
  path = require("path");

var WebvisualServer = require("./server.js");
var webvisualserver;
var Settings = require("./settings");
var appConfigLoader = {};

// Keep a global reference of the window object, if you don"t, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;
var config;

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  // OS X
  if (process.platform != "darwin") {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.

app.on("ready", function() {
  // Create the browser window.
  appConfigLoader = new Settings(app);

  appConfigLoader.on("error", function(err) {
    console.log("Error in Config", err);
  });

  appConfigLoader.on("ready", function(msg, settings) {
    console.log(msg);

    config = settings;

    mainWindow = new BrowserWindow(config.app);

    // load server GUI
    mainWindow.loadURL("file://" + __dirname + "/public/app.html");

    mainWindow.webContents.on("dom-ready", () => {
      // Log to main process
      console.log = function () {
        mainWindow.webContents.send("log", util.format.apply(null, arguments) + "\n");
        process.stdout.write(util.format.apply(null, arguments) + "\n");
      }
      console.error = console.log;

      mainWindow.webContents.send("event", "set-user-config", config.userConfigFiles);
      mainWindow.webContents.send("event", "set-renderer", config.renderer);
      mainWindow.webContents.send("event", "set-server-config", config.server);
    });

    webvisualserver = new WebvisualServer(config);
    webvisualserver.on("error", function(err, msg) {
      console.log("Error in", err, msg || "");
    });
    webvisualserver.on("log", function(arg, msg) {
      console.log(arg, msg || "");
    });
    webvisualserver.on("server-start", function(err) {
      mainWindow.webContents.send("event", "server-start");
    });
    webvisualserver.on("server-stop", function(err) {
      mainWindow.webContents.send("event", "server-stop");
    });
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is going to be closed.
    mainWindow.on("close", function() {
      let bounds = mainWindow.getBounds();
      config.app.width = bounds.width;
      config.app.height = bounds.height;
      config.app.x = bounds.x;
      config.app.y = bounds.y;
      appConfigLoader.save(config);
    });
    // Emitted when the window is closed.
    mainWindow.on("closed", function() {
      mainWindow = null;
    });
  });

  appConfigLoader.on("change", function(settings) {
    webvisualserver.setConfig(settings);
  });

  // app quit
  ipcMain.on("event", (e, event, arg) => {
    switch (event) {
      case "server-start":
        webvisualserver.connect();
        break;
      case "server-restart":
        webvisualserver.reconnect();
        break;
      case "server-stop":
        webvisualserver.disconnect();
        break;
      case "server-toggle":
        webvisualserver.toggle();
        break;
      case "config-filepath":
        dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            {name: "JSON", extensions: ["json"]}
          ]
        }, openConfigFile);
        break;
      case "add-user-config":
        addConfigFile(arg);
        break;
      case "remove-user-config":
        removeConfigFile(arg);
        break;
      case "set-server-config":
        appConfigLoader.setEntry({server: arg});
        break;
    }
  });

  // addConfigFile
  function openConfigFile(files) {
    mainWindow.webContents.send("event", "config-filepath", (files && files.length > 0) ? files[0] : "");
  }

  function addConfigFile(arg) {
    if (!arg.name)
      arg.name = "test";
    if (arg.path) {
      config.userConfigFiles[arg.name] = { path: arg.path, renderer: arg.renderer };
      appConfigLoader.set(config);
      mainWindow.webContents.send("event", "set-user-config", config.userConfigFiles);
    }
  }

  function removeConfigFile(arg) {
    if (arg.name) {
      delete config.userConfigFiles[arg.name];
      appConfigLoader.set(config);
      mainWindow.webContents.send("event", "set-user-config", config.userConfigFiles);
    }
  }

  // clientView
  // ipcMain.on("open-client-view", function() {
  //   clientView = new BrowserWindow(appConfig.options);
  //   clientView.loadURL("https://127.0.0.1:3000/login");
  // });

  /*
   * Handle various process events
   */

  process.on("uncaughtException", function(err) {
    console.log("uncaughtException", err);
    // webvisualserver.reconnect();
  });

  process.on("ECONNRESET", function(err) {
    console.log("connection reset (ECONNRESET)", err);
    // webvisualserver.reconnect();
  });

  process.on("SIGINT", function(err) {
    console.log("close webvisual (SIGINT)");
    // webvisualserver.disconnect();
    process.exit(0);
  });

  process.on("exit", function(err) {
    console.log("close webvisual (EXIT)");
    // webvisualserver.disconnect();
  });
});
