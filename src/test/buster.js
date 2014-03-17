var config = module.exports;

// config["Default"] = {
// };

// config["Browser tests"] = {
//   // extends: "Default",
//   environment: "browser",
//   libs: [
//     "public/js/jquery-2.0.2.js",
//     "public/js/foundation/*.js",
//     "public/js/vendor/zepto.js",
//     "public/js/vendor/custom.modernizr.js",
//     "public/js/rgraph/RGraph*.js",
//     "public/js/moment/moment.js"
//   ],
//   src: [
//     "public/js/graphs/**/*.js",
//     "public/js/*/*.js"
//   ],
//   tests: ["browser/*-test.js"]
// };

config["Node tests"] = {
  // extends: "Default",
  environment: "node",
  tests: ["node/*-test.js"]
};