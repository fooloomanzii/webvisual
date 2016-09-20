var defaults = {
	size: 10000, // Length of each DataRow (by id in values)
	is: 'Array', // TODO: +ArrayBuffer
	type: 'Float64', // TODO: TypedArray
	primary: undefined // 'append' or 'prepend'
};

function CacheKey(options) {
	// Set Options
	for (var type in options) {
		this[type] = options[type];
	}
	// Merge Defaults
	for (var type in defaults) {
		if (this[type] === undefined)
			this[type] = defaults[type];
	}
	this._cache = {}; // internal Cache

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
	},

	setAsBuffer: function() {
		switch (this.type) {
			case 'Float64':
				break;
		}
	},

	clear: function() {
		delete this.first;
		delete this.last;
		delete this._cache;
	},

	request: function(len) {
		var start = (len >= 0 && len < this._cache.length) ? this._cache.length - len - 1 : 0;
		return this._cache.slice(start);
	},

  range: function(key) {
    if (key === undefined)
      return [this.first, this.last];
    else
      return [this.first[key], this.last[key]];
  },

  last: function() {
    return this.values[this.values.length-1];
  },

  first: function() {
    return this.values[0];
  },

  max: function(key) {
    var temp = this._cache.slice(0);
    return temp.sort(this.compareFn(key, -1))[0];
  },

  min: function(key) {
    var temp = this._cache.slice(0);
    return temp.sort(this.compareFn(key, 1))[0];
  },

  compareFn: function(key, order) {
    order = order || 1;
    return function (a,b) {
      return (a[key] < b[key]) ? -1 * order : (a[key] > b[key]) ? 1 * order: 0;
    }
  },

	append: function(data) {
		var len = data.length;
		if (len > this.size)
			data = data.slice(len - this.size, len);
		if (this.values.length === 0)
			this.values = data[id];
		else
			this.values = this.values.concat(data);
		if (this.values.length > this.size)
			this.values.splice(0, this.values.length - this.size);
    if (this.primary)
      this.values.sort(this.compareFn(this.primary));
	}
}

function Cache(name, label, options) {
	// Set Options
  this.name = name;
  this.label = label;
	this.options = options;
}

CacheKey.prototype = {

	clear: function(ids) {
		if (ids === undefined) {
			ids = Object.keys(this._cache);
		} else if (Array.isArray(ids) === false) {
			ids = [ids];
		}
		for (let id in ids) {
			if (this._cache[id]) {
				delete this[id];
				delete this._cache[id];
			}
		}
	},

	request: function(len, ids) {
		if (ids === undefined || !Array.isArray(ids)) {
			ids = Object.keys(this._cache);
		}
		var ret = {};
		for (var id of ids) {
			if (id in this._cache) {
				ret[id] = this._cache[id].request(len);
			}
		}
		return ret;
	},

  lth: function(a, b) {
    return a > b;
  },

  sth: function(a, b) {
    return a < b;
  },

  operation: function(func, compareFn, ids, key) {
    if (ids === undefined || !Array.isArray(ids)) {
      ids = Object.keys(this._cache);
    }
    var val, temp;
    for (var id of ids) {
      if (id in this._cache) {
        temp = this._cache[id].min(key);
        if (val === undefined || compareFn(temp, val))
          val = temp;
      }
    }
    return val;
  },

  min: function(ids, key) {
    return this.operation('min', this.sth, ids, key);
  },
  max: function(ids, key) {
    return this.operation('max', this.lth, ids, key);
  },
  first: function(ids, key) {
    return this.operation('first', this.sth, ids, key);
  },
  last: function(ids, key) {
    return this.operation('last', this.lth, ids, key);
  },

  range: function(ids) {
    return [max];
  },

	append: function(data) {
		for (var id in data) {
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
