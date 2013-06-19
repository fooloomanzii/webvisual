var socket = io.connect('http://'+window.location.host+'/data');
socket.on('data', function(data) {
	data = data.data;

	if((!data  && data !== null) || data.length < 1) {
		return;
	}

	var values = data.pop().values,
		tmp;

	for(var i=0; i<3; ++i) {
		tmp = undefined;
		if(values.length > i) tmp = values[i];


		$('#value'+i).text(tmp);
	}
});