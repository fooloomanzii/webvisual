var buster = require('buster'),
	cw = require('../../modules/copywatch'),
	dp = require('../../modules/data_parser'),
	fs = require('fs'),
	file = __dirname+'/copywatch-test.txt';

function resetFile() {
	fs.writeFileSync(file,
		"Dies ist ein Testfile.\n\nDie Inhalte dieser Datei werden kopiert werden.",
		'utf8');
} resetFile();

// Extend the object file with a function
function extendObj(oldObj, newObj) {
	Object.keys(newObj).forEach(function(item) {
		oldObj[item] = newObj[item];
	});
}


// Make sure the watch_error is a stub
var error_handler;
	watch = function(mode, files, options, next) {
	if(typeof options === 'function') {
		next = options;
		options = {};
	} options = options || {};

	options.watch_error = options.watch_error || error_handler;

	cw.watch(mode, files, options, next);
};

// Make sure, that parse doesn't get bullshit lines
var parse = function(string, callback) {
	if(string.length > 2) dp.parse(string, callback);
	else callback(null, string);
};

var cpFile;
buster.testCase("Copywatch", {
	setUp: function() {
		// Make sure the error_handler is a spy
		error_handler = this.spy();
		// copywatch file
		cpFile = file+cw.getExtension();
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
		setUp: function() {
			this.remove = true;
			// cw options
			this.options = {};
		},
		tearDown: function(done) {
			cw.clear(this.remove, function(err) {
				refute.defined(err);
				resetFile();

				// We are done
				done();
			});
		},
		"ignores different files test": function(done) {
			var mode = 'all',
				diffFile = './DIFFERENT_FILE',
				cwFile = diffFile+cw.getExtension();

			watch(mode, file, this.options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Write a DIFFERENT file
				fs.writeFileSync(diffFile, 'data', 'utf8');

				// Wait if copywatch realises the change (it shouldn't)
				setTimeout(function() {
					refute(fs.existsSync(cwFile), "The file \""+cwFile+"\" shouldn't exist.");

					// Delete the file
					fs.unlinkSync(diffFile);

					// We are done
					done();
				}, 50)
			})
		},
		"default copy test": function(done) {
			var mode = 'all';
			extendObj(this.options, { firstCopy: false });

			// Start watching
			watch(mode, file, this.options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Rewrite file
				fs.writeFileSync(file, 'data', 'utf8');

				// We have to wait a few moments to ensure copywatch recognized the change
				setTimeout(function() {
					// Reread the content
					oldF = fs.readFileSync(file, 'utf8');
					newF = fs.readFileSync(cpFile, 'utf8');

					// Check content
					assert.equals(oldF, newF);

					// We are done
					done();
				}, 50);
			});
		},
		"content copy test": function(done) {
			var mode = 'all',
				expectedData = [
					["Dies ist ein Testfile.", "Die Inhalte dieser Datei werden kopiert werden."],
					['data']
				],
				index = 0;
			// Options
			extendObj(this.options, {
				content: function(err, data) {
					// No error
					assert.isNull(err);

					// And the expected data
					assert.equals(expectedData[index++], data);
				}
			});

			// Start watching
			watch(mode, file, this.options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Rewrite file
				fs.writeFileSync(file, 'data', 'utf8');

				// We have to wait a few moments to ensure copywatch recognized the change
				setTimeout(function() {
					// Reread the content
					oldF = fs.readFileSync(file, 'utf8');
					newF = fs.readFileSync(cpFile, 'utf8');

					// Check content; it's in JSON format
					assert.equals(JSON.parse(newF)[0], oldF);

					// We are done
					done();
				}, 50);
			});
		},
		"error copy test": function(done) {
			// No removal necessary
			this.remove = false;

			var mode = 'all';
			// Options
			extendObj(this.options, {
				copy: false
			});

			// Start watching
			watch(mode, file, this.options, function(err) {
				// Is err defined?
				refute.isNull(err);

				// We are done
				done();
			});
		},
		"process copy default test": function(done) {
			var content = '13.08.2013;01:02:03;20.903;13.790;8.340\n'+
				'13.08.2013;01:02:04;20.904;13.791;8.341\n'+
				'13.08.2013;01:02:05;20.905;13.792;8.342\n'+
				'13.08.2013;01:02:06;20.906;13.793;8.343',
				contentArr = content.split('\n'),
				parsedContent = [],
				mode = 'all';
			// Options
			extendObj(this.options, {
				// We don't need a first copy
				firstCopy: false,
				process: parse,
				content: function(err, data) {
					// There shouldn't be an error
					assert.isNull(err);

					setTimeout(function() {
						var fileContent = fs.readFileSync(cpFile, 'utf8');

						assert.equals(JSON.stringify(data), fileContent);
						assert.equals(data, parsedContent);

						// We are done
						done();
					}, 25);
				}
			});

			var fn = function(err, data) {
				assert.isNull(err);

				parsedContent.push(data);
			};
			// Parse the content
			for(var i=0; i<contentArr.length; ++i) {
				parse(contentArr[i], fn);
			}
			watch(mode, file, this.options, function(err) {
				assert.isNull(err);

				// Rewrite file
				setTimeout(function() {
					fs.writeFileSync(file,
						content,
						'utf8');
				}, 50);
			});
		},
		"process copy error test": function(done) {
			// Make sure, that there is no error; when trying to delete the file
			this.remove = false;

			// We don't create a valid parser file, so there should be errors
			var mode = 'all',
				leave = false;
			// Options
			extendObj(this.options, {
				copy: false,
				process: parse,
				content: function(err, data) {
					// There should be errors
					refute.isNull(err);

					if(leave) done();
				}
			});

			// Start watching
			watch(mode, file, this.options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Rewrite file
				setTimeout(function() {
					leave = true;

					fs.writeFileSync(file,
						'ABC\n'+
						'DEF\n'+
						'GHI',
						'utf8');
				}, 50);
			});
		},
		"process copy append test": function(done) {
			// Create a valid parser file
			fs.writeFileSync(file,
				'13.08.2013;01:02:03;20.903;13.790;8.340\n'+
				'13.08.2013;01:02:04;20.904;13.791;8.341\n'+
				'13.08.2013;01:02:05;20.905;13.792;8.342',
				'utf8');

			var mode = 'append',
				leave = false;
			// Options
			extendObj(this.options, {
				process: parse,
				content: function(err, data) {
					assert.isNull(err);

					// We have to wait this moment to ensure, that the file already got writen
					setTimeout(function() {
						var fileString = fs.readFileSync(
							cpFile,
							'utf8');

						// The complete data should contain the added one
						for(var i=0; i<data.length; ++i) {
							assert.match(fileString, JSON.stringify(data[i]));
						}

						// End the test, if necessary
						if(leave) done();
					}, 50);
				}
			});

			// Start watching
			watch(mode, file, this.options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Append to file
				setTimeout(function() {
					leave = true;

					fs.writeFileSync(
						file,
						'\n13.08.2013;01:02:06;20.906;13.793;8.343',
						{ encoding: 'utf8', flag: 'a' }
					);
				}, 50);
			});
		},
		"process copy prepend test": function(done) {
			// Create a valid parser file
			fs.writeFileSync(file,
				'13.08.2013;01:02:03;20.903;13.790;8.340\n'+
				'13.08.2013;01:02:04;20.904;13.791;8.341\n'+
				'13.08.2013;01:02:05;20.905;13.792;8.342',
				'utf8');

			var mode = 'prepend',
				leave = false;
			// Options
			extendObj(this.options, {
				process: parse,
				content: function(err, data) {
					assert.isNull(err);

					// We have to wait this moment to ensure, that the file already got writen
					setTimeout(function() {
						var fileString = fs.readFileSync(
							cpFile,
							'utf8');

						// The complete data should contain the added one
						for(var i=0; i<data.length; ++i) {
							assert.match(fileString, JSON.stringify(data[i]));
						}

						if(leave) done();
					}, 50);
				}
			});

			// Start watching
			watch(mode, file, this.options, function(err) {
				// Is err defined?
				assert.isNull(err);

				// Prepend to file
				setTimeout(function() {
					leave = true;

					var content = '13.08.2013;01:02:06;20.906;13.793;8.343\n'+
						fs.readFileSync(file, 'utf8');

					fs.writeFileSync(
						file,
						content,
						'utf8'
					);
				}, 50);
			});
		}
	},
	"unwatch": {
		"delete test": function(done) {
			// Start watching, so we can stop watching
			watch('all', file, function(err) {
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
						fs.unlink(cpFile, function(err) {
							// There should be an error, since there was no file
							if(err === null) err = undefined;
							assert.defined(err);

							// We are done
							done();
						});
					});
				}, 50);
			});
		},
		"not delete test": function(done) {
			// Start watching, so we can stop watching
			watch('all', file, function(err) {
				// There shouldn't be an error
				if(err === null) err = undefined;
				refute.defined(err);

				setTimeout(function() {
					// Stop watching and remove the file
					cw.unwatch(file, false, function(err) {
						if(err === null) err = undefined;
						refute.defined(err);

						// Check if the copied file got removed too
						fs.unlink(cpFile, function(err) {
							// There shoudln't be an error, since there was a file
							if(err === null) err = undefined;
							refute.defined(err);

							// We are done
							done();
						});
					});
				}, 50);
			});
		}
	}
});

buster.testCase("Copywatch private", {
	setUp: function() {
		// copywatch file
		cpFile = file+cw.getExtension();
	},
	tearDown: function() {
		// Just make sure, that I don't forget this
		delete cw._watcher[file];
	},
	"_error_handler": {
		setUp: function() {
			// Replace the error method for the test
			this.error_stub = this.stub(console, "error");
		},
		tearDown: function() {
			// Restore the error method
			this.error_stub.restore();
		},
		"does nothing": function() {
			// There is no error, so there shouldn't be an output
			cw._error_handler(undefined);

			// An empty array, so still no error
			cw._error_handler([]);

			// Hopefully there shouldn't be a call
			refute.called(this.error_stub);
		},
		"outputs an error": function() {
			// Simple string
			cw._error_handler("Test");

			// Number
			cw._error_handler(1);

			// Error
			cw._error_handler(new Error("Test"));

			// Was it properly called?
			assert.calledThrice(this.error_stub);
		}
	},
	"_check_mode": {
		"returns no error": function() {
			var mode = 'append';
			assert.isNull(cw._check_mode(mode),
				"Expected no exception with mode "+mode);

			mode = 'prepend';
			assert.isNull(cw._check_mode(mode),
				"Expected no exception with mode "+mode);

			mode = 'all';
			assert.isNull(cw._check_mode(mode),
				"Expected no exception with mode "+mode);

			mode = 'prepend';
			assert.isNull(cw._check_mode(mode),
				"Expected no exception with mode "+mode);
		},
		"returns an error": function() {
			var mode = 'TEST';
			assert.defined(cw._check_mode(mode),
				"Expected an exception with mode "+mode);

			mode = undefined;
			assert.defined(cw._check_mode(mode),
				"Expected an exception with mode "+mode);

			mode = 'prepend!';
			assert.defined(cw._check_mode(mode),
				"Expected an exception with mode "+mode);
		}
	},
	"_check_file": {
		"returns no error": function() {
			var path = __filename;

			// There shoudln't be an error
			assert.isNull(cw._check_file(path),
				"Expected no exception with path "+path);
		},
		"returns an error": function() {
			var path;

			// undefined path
			assert.defined(cw._check_file(path),
				"Expected exception with path "+path);

			// nonsense path
			path = 'A/B/C/D';
			assert.defined(cw._check_file(path),
				"Expected exception with path "+path);

			// Directory path
			path = __dirname;
			assert.defined(cw._check_file(path),
				"Expected exception with path "+path);
		}
	},
	"_file_options creates correct object": function() {
		var start,
			end,
			obj   = {
			readOptions: {},
			writeOptions: {}
		};

		assert.equals(cw._file_options(start, end), obj);

		start = 0;
		obj.readOptions.start = start;
		obj.writeOptions.start = start;
		obj.writeOptions.flags = 'a';

		assert.equals(cw._file_options(start, end), obj);

		end = 20;
		obj.readOptions.end = end-1;

		assert.equals(cw._file_options(start, end), obj);
	},
	"_copy copies file": function(done) {
		cw._copy(file);

		// We have to wait a moment
		setTimeout(function() {
			// Is the file there ?
			fs.exists(cpFile, function(ex) {
				assert(ex, cpFile+" doesn't exist.");
				if(!ex) return; // No need to check the contents, when there is no file

				// Check the content
				var oldF = fs.readFileSync(file, 'utf8'),
					newF = fs.readFileSync(cpFile, 'utf8');

				// Check content
				assert.equals(oldF, newF);

				// Delete the file
				if(ex) fs.unlinkSync(cpFile);

				// We are done
				done();
			});
		}, 100);
	},
	"_process_functions": {
		setUp: function() {
			// Empty lines are getting skipped
			this.expectedData = [
				"Dies ist ein Testfile.",
				"Die Inhalte dieser Datei werden kopiert werden."
			];

			this.echo = function(string, callback) {
				// A simple echo, if you want so
				callback(undefined, string);
			};
		},
		"_process_copy writes the processed data": function(done) {
			// This is necessary since the function looks up the data on the watcher
			cw._watcher[file] = {};

			// We need access to the this object
			var that = this;

			cw._process_copy(file, undefined, undefined, this.echo);

			setTimeout(function() {
				fs.readFile(cpFile, 'utf8', function(err, data) {
					assert.isNull(err);

					// Compare the content of the file to the recieved stuff
					assert.equals(JSON.parse(data), that.expectedData);

					// Delete the copied file
					fs.unlinkSync(cpFile);

					// Delete the pseudo watcher in cw
					delete cw._watcher[file];

					// We are done
					done();
				});
			}, 50);
		},
		"_process_read reads the data into an array": function(done) {
			// We need access to the this object
			var that = this;

			cw._process_read(file, undefined, undefined, this.echo,
				function(err, data) {
					// No errors please
					assert.isNull(err);

					assert.equals(data, that.expectedData);

					// We are done
					done();
				}
			);
		}
	},
	"_create_watch_options": function() {
		var fn = cw._create_watch_options,
			mode = 'all',
			content = function() {},
			options = {
				copy: false,
				watch_error: function() {},
				process: 'bla'
			},
			expectedOptions = {
				firstCopy: true,
				mode: 'all',
				watch_error: options.watch_error,
				process: cw._default.process,
				content: content,
				work_function: cw._process_read
			};

		obj = fn(mode, options);
		// TypeError since process is a string, rather than a function
		assert(obj instanceof TypeError, "Expected to be an TypeError.");

		options.process = undefined;

		var obj = fn(mode, options);
		// Error since there is no content function, which is needed when copy == false
		assert(obj instanceof Error, "Exected to be an Error.");

		options.content = content;

		// Now it should work
		assert.equals(fn(mode, options), expectedOptions);
	},
	"_handle_change": function() {
		var spy = this.spy(),
			options = {
				mode: 'Asdsadsad',
				work_function: spy
			};

		function call(event) {
			cw._handle_change(event, file, {}, {}, options);
		}

		call('ABC');

		// There should be no call
		refute.called(spy);

		call('update');

		// There should be no call
		refute.called(spy);

		// Valid mode
		options.mode = 'append';

		// Another spy
		this.spy(fs, 'exists');

		call('update');
		call('create');
		call('delete');

		// Just 'update' and 'create' should result in a call
		assert.calledTwice(spy);
		// 'delete' should call exists from fs
		assert.called(fs.exists);

		// Restore fs.exists
		fs.exists.restore();
	},
	"_create_listeners gives a nice object": function() {
		var handleStub = this.stub(),
			options = {
				mode: 'all', // Necessary for proper calling
				watch_error: function() {},
				work_function: handleStub
			},
			listeners = cw._create_listeners(options);

		// It should use the given error handler
		assert.equals(listeners.error, options.watch_error);

		// Shouldn't call handle_change
		listeners.change();

		refute.called(handleStub);

		// Fake watcher
		cw._watcher[file] = {};

		// Should call handle_change
		listeners.change('update', file);

		assert.called(handleStub);

		// Console stub
		var consoleStub = this.stub(console, 'log');

		// Shouldn't call console.log
		listeners.log('HABA', 'test');

		refute.called(consoleStub);

		// Should call console.log
		listeners.log('dev', 'test');

		assert.called(consoleStub);

		// Restore
		consoleStub.restore();
	}
});
