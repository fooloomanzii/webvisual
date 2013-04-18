/*var object = {test: 'test'};

console.log(object);

var object2 = { a: 'abc', b: 'def' };
for(var prop in object2) {
	object[prop] = object2[prop];
}

console.log(object);*/

/*function test() {
	console.log(test);
	// console.log(test.foo);
}

test.foo = 'bar';

test();*/

var object = { foo: "bar" };

console.log(JSON.stringify(object));