var config = module.exports;

config["Browser tests"] = {
	environment: "browser",
	rootPath: "../",
	libs: [
		"public/js/jquery-2.0.2.js",
		"public/js/foundation/*.js",
		"public/js/vendor/zepto.js",
		"public/js/vendor/custom.modernizr.js",
		"public/js/rgraph/RGraph*.js",
		"public/js/moment/moment.js"
	],
	src: [
		"public/js/graphs/**/*.js",
		"public/js/*/*.js"
	],
	tests: ["test/browser/*test.js"]
};

config["Node tests"] = {
	environment: "node",
	tests: ["test/node/*test.js"]
};