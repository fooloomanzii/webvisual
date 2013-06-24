$(document).ready(function(){
	// Activate the hide-header function
	$('#hide-header').click(function() {
		$('#header').animate({
			height: 'hide',
			opacity: 'hide'
		}, 'slow');
	});
});