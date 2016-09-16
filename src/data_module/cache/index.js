var defaults = {
	maxLength: 10000, // Length of each DataRow (by id in values)
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
			set: function(v) {
				for (var id in v) {
					if (this._cache[id] === undefined) {
						this._cache[id] = [];
						if (id !== 'values')
							Object.defineProperty(this, id, {
								get: function() {
									return this._cache[id];
								},
								set: function(obj) {
									this.values = {
										id: obj
									};
								},
								enumerable: true,
								configurable: true
							});
					}
					for (var i = 0; i < v[id].length-1; i--)
						this._cache[id].push(v[id][i]);
					if (this._cache[id].length > this.maxValues)
						this._cache[id].splice(0, this._cache[id].length - this.maxValues);
				}
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
}

module.exports = Cache;
