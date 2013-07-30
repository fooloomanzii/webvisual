var buster = require('buster'),
	cw = require('../../modules/copywatch'),
	fs = require('fs'),
	file = 'C:/Users/s.wolf/Projekte/Messdatenvisualisierung/src/test/node/copywatch-test.txt';

function resetFile() {
	fs.writeFileSync(file,
		"Dies ist ein Testfile.\n\nDie Inhalte dieser Datei werden kopiert werden.",
		'utf8');
}


var error_handler,
	cwwatch = cw.watch;
// Make sure the watch_error is a stub
cw.watch = function(mode, files, options, next) {
	if(typeof options === 'function') {
		next = options;
		options = {};
	} options = options || {};

	options.watch_error = options.watch_error || error_handler;

	cwwatch(mode, files, options, next);
};

buster.testCase("Copywatch", {
	setUp: function() {
		// Make sure the error_handler is a stub
		error_handler = this.spy();
	},
	tearDown: function() {
		refute.called(error_handler);
	},
	"set/get extension test": function() {
		assert.equals(cw.getExtension(), "_node");

		cw.setExtension("_test");

		assert.equals(cw.getExtension(), "_test");

		cw.setExtension("_node");
	},
	"watch": {
		tearDown: function() {
			cw.clear(true, refute.defined);
			resetFile();
		},
		"default copy test": function(done) {
			var mode = 'all',
				options = {
					parse_callback: this.spy()
				};

			// Start watching
			cw.watch(mode, file, options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Does the copied version exist?
				assert(fs.existsSync(file+cw.getExtension()),
					"\""+file+"\"s copied version doesn't exist.");

				var oldF = fs.readFileSync(file, 'utf8'),
					newF = fs.readFileSync(file+cw.getExtension(), 'utf8');

				// Check content
				assert.equals(oldF, newF);

				// Rewrite file
				fs.writeFileSync(file, 'data', 'utf8');

				// We have to wait a few moments to ensure copywatch recognized the change
				setTimeout(function() {
					// Reread the content
					oldF = fs.readFileSync(file, 'utf8');
					newF = fs.readFileSync(file+cw.getExtension(), 'utf8');

					// Check content
					assert.equals(oldF, newF);

					// Check if the parse callback was called; it shoudln't
					refute.called(options.parse_callback);

					// Remove the file from the watchlist
					cw.clear(true, refute.defined);

					// We are done
					done();
				}, 50);
			});
		},
		"parsecopy test": function(done) {
			// Create a valid parser file
			fs.writeFileSync(file,
				'13.08.2013;01:02:03;20.903;13.790;8.340\n'+
				'13.08.2013;01:02:04;20.904;13.791;8.341\n'+
				'13.08.2013;01:02:05;20.905;13.792;8.342',
				'utf8');

			var mode = 'all',
				options = {
					copy_function: 'parse',
					parse_callback: function(err, data) {
						refute.defined(err);

						// We have to wait this moment to ensure, that the file already got writen
						setTimeout(function() {
							var fileString = fs.readFileSync(
								file+cw.getExtension(),
								'utf8');

							assert.equals(JSON.stringify(data), fileString);
						}, 20);
					}
				};

			// Start watching
			cw.watch(mode, file, options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Rewrite file
				setTimeout(function() {
					fs.writeFileSync(file,
						'13.08.2013;01:02:06;20.906;13.793;8.343\n'+
						'13.08.2013;01:02:07;20.907;13.794;8.344\n'+
						'13.08.2013;01:02:08;20.908;13.795;8.345',
						'utf8');

					// We are done
					setTimeout(done, 50);
				}, 50);
			});
		},
		"parsecopy error test": function(done) {
			// We don't create a valid parser file, so there should be errors

			var mode = 'all',
				options = {
					copy_function: 'parse',
					parse_callback: function(err, data) {
						// There should be errors
						assert.defined(err);

						// We have to wait this moment to ensure, that the file already got writen
						setTimeout(function() {
							var fileString = fs.readFileSync(
								file+cw.getExtension(),
								'utf8');

							assert.equals(JSON.stringify(data), fileString);
						}, 10);
					}
				};

			// Start watching
			cw.watch(mode, file, options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Rewrite file
				setTimeout(function() {
					fs.writeFileSync(file,
						'ABC\n'+
						'DEF\n'+
						'GHI',
						'utf8');

					// We are done
					setTimeout(done, 50);
				}, 50);
			});
		},
		"parsecopy append test": function(done) {
			// Create a valid parser file
			fs.writeFileSync(file,
				'13.08.2013;01:02:03;20.903;13.790;8.340\n'+
				'13.08.2013;01:02:04;20.904;13.791;8.341\n'+
				'13.08.2013;01:02:05;20.905;13.792;8.342',
				'utf8');

			var mode = 'end',
				options = {
					copy_function: 'parse',
					parse_callback: function(err, data) {
						refute.defined(err);

						// We have to wait this moment to ensure, that the file already got writen
						setTimeout(function() {
							var fileString = fs.readFileSync(
								file+cw.getExtension(),
								'utf8');

							// The complete data should contain the added one
							for(var i=0; i<data.length; ++i) {
								assert.match(fileString, JSON.stringify(data[i]));
							}
						}, 10);
					}
				};

			// Start watching
			cw.watch(mode, file, options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Append to file
				setTimeout(function() {
					fs.writeFileSync(
						file,
						'\n13.08.2013;01:02:06;20.906;13.793;8.343',
						{ encoding: 'utf8', flag: 'a' }
					);

					// We are done
					setTimeout(done, 50);
				}, 50);
			});
		},
		"parsecopy prepend test": function(done) {
			// Create a valid parser file
			fs.writeFileSync(file,
				'13.08.2013;01:02:03;20.903;13.790;8.340\n'+
				'13.08.2013;01:02:04;20.904;13.791;8.341\n'+
				'13.08.2013;01:02:05;20.905;13.792;8.342',
				'utf8');

			var mode = 'begin',
				options = {
					copy_function: 'parse',
					parse_callback: function(err, data) {
						refute.defined(err);

						// We have to wait this moment to ensure, that the file already got writen
						setTimeout(function() {
							var fileString = fs.readFileSync(
								file+cw.getExtension(),
								'utf8');

							// The complete data should contain the added one
							for(var i=0; i<data.length; ++i) {
								assert.match(fileString, JSON.stringify(data[i]));
							}
						}, 10);
					}
				};

			// Start watching
			cw.watch(mode, file, options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Prepend to file
				setTimeout(function() {
					fs.writeFileSync(
						file,
						'13.08.2013;01:02:06;20.906;13.793;8.343\n'+
						fs.readFileSync(file, 'utf8'),
						'utf8'
					);

					// We are done
					setTimeout(done, 50);
				}, 50);
			});
		}
	},
	"unwatch": {
		"delete test": function(done) {
			// Start watching, so we can stop watching
			cw.watch('all', file, function(err) {
				// There shouldn't be an error
				if(err === null) err = undefined;
				refute.defined(err);

				// Wait a few moments to make sure, everything was finished
				setTimeout(function() {
					// Stop watching and remove the file
					cw.unwatch(file, true, function(err) {
						if(err === null) err = undefined;
						refute.defined(err);

						// Check if the copied file got removed too
						fs.unlink(file+cw.getExtension(), function(err) {
							// There should be an error, since there was no file
							if(err === null) err = undefined;
							assert.defined(err);

							// We are done
							done();
						});
					});
				}, 20);
			});
		},
		"not delete test": function(done) {
			// Start watching, so we can stop watching
			cw.watch('all', file, function(err) {
				// There shouldn't be an error
				if(err === null) err = undefined;
				refute.defined(err);

				setTimeout(function() {
					// Stop watching and remove the file
					cw.unwatch(file, false, function(err) {
						if(err === null) err = undefined;
						refute.defined(err);

						// Check if the copied file got removed too
						fs.unlink(file+cw.getExtension(), function(err) {
							// There shoudln't be an error, since there was a file
							if(err === null) err = undefined;
							refute.defined(err);

							// We are done
							done();
						});
					});
				}, 20);
			});
		}
	}
});

// buster.testCase("Copywatch private", {

// });
