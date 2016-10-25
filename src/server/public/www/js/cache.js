(function() {
	'use strict';
	const defaults = {
		size: 5400, // Length of each DataRow (by id in values)
		is: 'Array', // TODO: +ArrayBuffer
		type: 'Float64', // TODO: TypedArray
		primary: undefined // 'append' or 'prepend'
	};

	function CacheKey(options) {
		// Set Options
		for (let type in options) {
			this[type] = options[type];
		}
		// Merge Defaults
		for (let type in defaults) {
			if (this[type] === undefined)
				this[type] = defaults[type];
		}

		switch (this.is) {
			case 'Array':
				this.setAsArray();
				break;
			case 'ArrayBuffer':
				this.setAsBuffer();
				break;
		}
	}

	CacheKey.prototype = {

		setAsArray: function() {
			this._cache = Array.prototype;
			Object.defineProperty(this, "values", {
				get: function() {
					return this._cache;
				},
				set: function(data) {
					this.append(data);
				},
				enumerable: false,
				configurable: true
			});
			this._splices = Array.prototype;
			Object.defineProperty(this, "splices", {
				get: function() {
					return this._splices.splice(0, this._splices.length);
				},
				enumerable: false,
				configurable: true
			});
			this._heap = Array.prototype;
			Object.defineProperty(this, "heap", {
				get: function() {
					return this._heap.splice(0,this._heap.length);
				},
				enumerable: false,
				configurable: true
			});
		},

		setAsBuffer: function() {
			switch (this.type) {
				case 'Float64':
					break;
			}
		},

		clear: function() {
			this._spliced.length = 0; // clear array
			this._heap.length = 0;
			this._cache.length = 0;
		},

		request: function(len) {
			const start = (len >= 0 && len < this._cache.length) ? this._cache.length - len - 1 : 0;
			return this._cache.slice(start);
		},

	  range: function(key) {
	    if (key === undefined)
	      return [this.first, this.last];
	    else
	      return [this.first[key], this.last[key]];
	  },

	  last: function(key) {
	    return this._cache[this._cache.length-1][key];
	  },

	  first: function(key) {
	    return this._cache[0][key];
	  },

	  max: function(key) { // inspired by d3.array
			let i = -1,
		      a,
		      b;
			const n = this._cache.length;

			while (++i < n) if ((b = this._cache[i][key]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = this._cache[i][key]) !== null && a < b) { a = b; }

	    return a;
	  },

	  min: function(key) { // inspired by d3.array
			let i = -1,
		      a,
		      b;
			const n = this._cache.length;

			while (++i < n) if ((b = this._cache[i][key]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = this._cache[i][key]) !== null && a > b) a = b;

	    return a;
	  },

	  compareFn: function(key, order) {
	    order = order || 1;
	    return function (a,b) {
	      return (a[key] < b[key]) ? -1 * order : (a[key] > b[key]) ? 1 * order: 0;
	    }
	  },

		append: function(data) {
			let len = data.length;
			if (len > this.size)
				data = data.slice(len - this.size, len);
			this._heap = this._heap.concat(data);
			if (this._cache.length === 0)
				this._cache = data;
			else
				this._cache = this._cache.concat(data);
			if (this._cache.length > this.size)
				this._splices = this._splices.concat(this._cache.splice(0, this._cache.length - this.size));
	    if (this.primary)
	      this._cache.sort(this.compareFn(this.primary));
		}
	}

	function ClientCache(name, label, options) {
		// Set Options
	  this.name = name;
	  this.label = label;
		this.options = options;
		this._cache = {};
	}

	ClientCache.prototype = {

		clear: function(ids) {
			if (ids === undefined) {
				ids = Object.keys(this._cache);
			} else if (Array.isArray(ids) === false) {
				ids = [ids];
			}
			for (let id in ids) {
				if (this._cache[id]) {
					this._cache[id].clear();
				}
			}
		},

		request: function(len, ids) {
			if (ids === undefined || !Array.isArray(ids)) {
				ids = Object.keys(this._cache);
			}
			let ret = {};
			for (let i in ids) {
				if (ids[i] in this._cache) {
					ret[ids[i]] = this._cache[ids[i]].request(len);
				}
			}
			return ret;
		},

		_max: function(array) { // inspired by d3.array
			let i = -1,
		      a,
		      b;
			const n = array.length;

			while (++i < n) if ((b = array[i]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = array[i]) !== null && a < b) a = b;

	    return a;
	  },

	  _min: function(array) { // inspired by d3.array
			let i = -1,
		      a,
		      b;
			const n = array.length;

			while (++i < n) if ((b = array[i]) !== null && b >= b) { a = b; break; }
			while (++i < n) if ((b = array[i]) !== null && a > b) a = b;

	    return a;
	  },

	  operation: function(func, compareFn, key, ids) {
	    if (ids === undefined || !Array.isArray(ids)) {
	      ids = Object.keys(this._cache);
	    }
	    let temp = [];
	    for (let i in ids) {
	      if (ids[i] in this._cache) {
	        temp.push(this._cache[ids[i]][func](key));
	      }
	    }
	    return compareFn(temp, key);
	  },

	  min: function(ids, key) {
	    return this.operation('min', this._min, key, ids);
	  },
	  max: function(ids, key) {
	    return this.operation('max', this._max, key, ids);
	  },
	  first: function(ids, key) {
	    return this.operation('first', this._min, key, ids);
	  },
	  last: function(ids, key) {
	    return this.operation('last', this._max, key, ids);
	  },

	  range: function(ids) {
	    return [this.first(ids, 'x'), this.last(ids, 'x')];
	  },

	  rangedValues: function(ids, key) {
	    return [this.min(ids, key), this.max(ids, key)];
	  },

		append: function(data) {
			for (let id in data) {
				if (this._cache[id] === undefined) {
					this._cache[id] = new CacheKey(this.options);
					Object.defineProperty(this, id, {
						get: function() {
							return this._cache[id];
						},
						set: function(obj) {
							this._cache[id].append(obj);
						},
						enumerable: true,
						configurable: true
					});
				}
				this._cache[id].append(data[id]);
			}
		}
	}
	window.ClientCache = ClientCache;
})();
