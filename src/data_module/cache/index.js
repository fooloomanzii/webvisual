var defaults = {
	size: 10000, // Length of each DataRow (by id in values)
	is: 'Array', // TODO: +ArrayBuffer
	type: 'Float64', // TODO: TypedArray
	mode: 'append' // 'append' or 'prepend'
};

class Cache {
	constructor(options) {
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

	setAsArray() {
		Object.defineProperty(this, "values", {
			get: function() {
				return this._cache;
			},
			set: function(data) {
				this.append(data);
			},
			enumerable: true,
			configurable: true
		});
	}

	setAsBuffer() {
		switch (this.type) {
			case 'Float64':
				break;
		}
	}

	clear(ids) {
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
	}

	request(len, ids) {
		if (ids === undefined || !Array.isArray(ids)) {
			ids = Object.keys(this._cache);
		}
		var start;
		var ret = {};
		for (var id of ids) {
			if (id in this._cache) {
				start = (len >= 0 && len < this._cache[id].length) ? this._cache[id].length - len - 1 : 0;
				ret[id] = this._cache[id].slice(start);
			}
		}
		return ret;
	}

	append(data) {
		for (var id in data) {
			if (this._cache[id] === undefined) {
				this._cache[id] = [];
				if (id !== '_cache')
					Object.defineProperty(this, id, {
						get: function() {
							return this._cache[id];
						},
						set: function(obj) {
							var res = {};
              res[id] = obj
							this.append(res);
						},
						enumerable: true,
						configurable: true
					});
			}
			var len = data[id].length;
			if (len > this.size)
				data[id] = data[id].slice(len - this.size, len);
			if (this._cache[id].length === 0)
				this._cache[id] = data[id];
			else
				for (var i = 0; i < data[id].length; i++)
					this._cache[id].push(data[id][i]);
			if (this._cache[id].length > this.size)
				this._cache[id].splice(0, this._cache[id].length - this.size);
		}
	}
}

module.exports = Cache;
