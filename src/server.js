"use strict";
/*
 * Module dependencies
 */
const express = require("express"),
	fs = require("fs"),
	path = require("path"),
	EventEmitter = require("events").EventEmitter,
	// DATA-MODULE
	dataModule = require("./data_module"),
	// Routing
	xFrameOptions = require("x-frame-options"),
	session = require("express-session"),
	passport = require("passport"),
	bodyParser = require("body-parser"),
	cookieParser = require("cookie-parser"),
	Router = require("./routes/index.js"),
	spdy = require("spdy"),
	http = require("http"),
	app = express(),
	redirectApp = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
	extended: true
})); // get information from html form
app.use(bodyParser.json());

app.use(session({
	secret: "&hkG#1dwwh!",
	resave: false,
	saveUninitialized: false
}));

// Prevent Clickjacking
app.use(xFrameOptions());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public", "www")));

class WebvisualServer extends EventEmitter {

	constructor(settings) {
		super();
		this.isRunning = false;
		this.config = settings;
		this.router = new Router(app, passport);
		this.router.on("error", (err) => {
			this.emit("error", err);
		});

		this.dataHandler = new dataModule();
		this.dataHandler.on("changed", (configuration, name) => {
			this.router.setConfiguration(configuration, name); // load Settings to Routen them to requests
		});
		this.dataHandler.on("error", (err) => {
			this.emit("error", err);
		});
	}

	createServer(settings, callback) {
		return new Promise((resolve, reject) => {
			if (settings)
				this.config = settings;

			if (this.isRunning)
				this.disconnect();

			this.isHttps = false;
			this.router.setSettings(this.config);

			try {
				// use https & http-redirecting
				if (!this.config.server.ssl ||
					!this.config.server.ssl.cert ||
					!this.config.server.ssl.key ||
					!this.config.server.ssl.passphrase ||
					!this.config.server.ssl.certchaindir) {
						this.mainServer = http.createServer(app);
						this.mainServer.on("error", (e) => {
								if (e.code === "EADDRINUSE") {
									this.emit("error", "HTTP Server \n Port " + this.config.server.port.http + " in use. Please check if \"node.exe\" is not already running on this port.");
									this.mainServer.close();
								} else if (e.code === "EACCES") {
									this.emit("error", "HTTP Server \n Network not accessable. Port " + this.config.server.port.http + " might be in use by another application. Try to switch the port or quit the application, which is using this port");
								} else {
									this.emit("error", e);
								}
							})
							.once("listening", () => {
								this.emit("log", "HTTP Server is listening on port " + this.config.server.port.http);
							});
						this.dataHandler.setServer(this.mainServer);
						resolve(false);
				} else {
					let cert = path.resolve(this.config.server.ssl.cert);
					let key = path.resolve(this.config.server.ssl.key);
					let passphrase = path.resolve(this.config.server.ssl.passphrase);
					let certchaindir = path.resolve(this.config.server.ssl.certchaindir);

					fs.access(cert, fs.constants.R_OK, (err) => {
						if (err)
							throw new Error('File for certification (ssl) not found' + "\n" + err);
						else {
							fs.access(key, fs.constants.R_OK, (err) => {
								if (err)
									throw new Error('File for public key (ssl) not found' + "\n" + err);
								else {
									fs.access(passphrase, fs.constants.R_OK, (err) => {
										if (err)
											throw new Error('File for pasphrase (ssl) not found' + "\n" + err);
										else {
											this.isHttps = true;
											// Configure SSL Encryption
											var sslOptions = {
												port: this.config.server.port.https,
												key: fs.readFileSync(key, "utf8"),
												cert: fs.readFileSync(cert, "utf8"),
												passphrase: require(passphrase).password,
												requestCert: true,
												rejectUnauthorized: false
											};
											var cert_chain = [];

											fs.readdirSync(certchaindir).forEach(function(filename) {
												cert_chain.push(
													fs.readFileSync(path.resolve(certchaindir, filename), "utf-8"));
											});
											sslOptions.ca = cert_chain;

											// Routing to https if http is requested
											redirectApp.get("*", (req, res, next) => {
												res.redirect("https://" + req.headers.host + ":" + this.config.server.port.https + req.path);
											});

											if (this.redirectServer)
												this.redirectServer.close();
											if (this.mainServer)
												this.mainServer.close();

											this.mainServer = spdy.createServer(sslOptions, app);
											this.redirectServer = http.createServer(redirectApp);

											// if Error: EADDRINUSE --> log in console
											this.redirectServer.on("error", (e) => {
													if (e.code === "EADDRINUSE") {
														this.emit("error", "HTTP Server \n Port " + this.config.server.port.http + " in use. Please check if \"node.exe\" is not already running on this port.");
														this.mainServer.close();
													} else if (e.code === "EACCES") {
														this.emit("error", "HTTP Server \n Network not accessable. Port " + this.config.server.port.http + " might be in use by another application. Try to switch the port or quit the application, which is using this port");
													} else {
														this.emit("error", e);
													}
												})
												.once("listening", () => {
													this.emit("log", "HTTP Server is listening for redirecting to https on port", this.config.server.port.http);
												});
											this.mainServer.on("error", (e) => {
													if (e.code === "EADDRINUSE") {
														this.emit("error", "HTTPS Server \n Port " + this.config.server.port.https + " in use. Please check if \"node.exe\" is not already running on this port.");
														this.mainServer.close();
													} else if (e.code === "EACCES") {
														this.emit("error", "HTTPS Server \n Network not accessable. Port " + this.config.server.port.https + " might be in use by another application. Try to switch the port or quit the application, which is using this port");
													} else {
														this.emit("error", e);
													}
												})
												.once("listening", () => {
													this.emit("log", "HTTPS Server is listening on port " + this.config.server.port.https);
												});
											this.dataHandler.setServer(this.mainServer);
											resolve(true);
										}
									});
								}
							});
						}
					});
				}
			} catch (err) {
				reject();
				return;
			}
		});
	}

	connect(settings) {
		// connect the DATA-Module
		if (this.isRunning === false) {
			this.emit("log", "WebvisualServer is starting");
			this.createServer(settings)
					.then( (isHttps) => {
						this.dataHandler.connect(this.config.userConfigFiles);
						if (isHttps === true) {
							this.redirectServer.listen(this.config.server.port.http || 80);
							this.mainServer.listen(this.config.server.port.https || 443);
						} else {
							this.mainServer.listen(this.config.server.port.http || 80);
						}
						this.isRunning = true;
						this.emit("server-start");
					})
					.catch( (err) => {
							this.emit("error", "Error in SSL Configuration" + "\n" + err)
					});
		}
	}

	disconnect() {
		this.emit("log", "WebvisualServer is closing");
		if (this.redirectServer)
			this.redirectServer.close();
		if (this.mainServer)
			this.mainServer.close();
		this.dataHandler.disconnect();
		this.isRunning = false;
		this.emit("server-stop");
	}

	reconnect(settings) {
		if (settings)
			this.config = settings;
		if (this.isRunning)
			this.disconnect();
		setTimeout(() => {
			this.connect();
		}, 2500);
	}

	toggle(settings) {
		if (settings)
			this.config = settings;
		if (this.isRunning)
			this.disconnect();
		else
			this.connect();
	}
};

module.exports = WebvisualServer;
