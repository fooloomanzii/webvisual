(function(){
	'use strict';
	
	var numCols,
		labelsArray={ //default-Values
			"title":"",
			"corner":"",
			"cols":[],
			"rows":{},
			"unnamedRow":"Value"
		},
		valuesArray,
		limitsArray={};

	// Check which value need to be chosen at the start
	function firstSelect(){
		var nvpair = {};
		var qs=window.location.search.replace('?', '');
		var pairs=qs.split('&');
		$.each(pairs, function(i, v){
		      var pair = v.split('=');
		      nvpair[pair[0]] = pair[1];
		});
		return nvpair.value;
	}

	// Arrange locals from Configuration data out of the data object
	function arrangeLocals(locals){
		if(locals){
			if(locals.table){
				if(locals.table.colors){
					if(locals.table.colors.under) {
						$('body').prepend('<style> .under { color: ' + locals.table.colors.under + ' } </style>');
					}
					if(locals.table.colors.over) {
						$('body').prepend('<style> .over { color: ' + locals.table.colors.over + ' } </style>');
					}
				}
				if(locals.table.labels){
					if(locals.table.labels.title) {
						labelsArray.title=locals.table.labels.title;
					}
					if(locals.table.labels.corner) {
						labelsArray.corner=locals.table.labels.corner;
					}
					if(locals.table.labels.cols) {
						labelsArray.cols=locals.table.labels.cols;
					}
					if(locals.table.labels.rows) {
						labelsArray.rows=locals.table.labels.rows;
					}
					if(locals.table.labels.unnamedRow) {
						labelsArray.unnamedRow=locals.table.labels.unnamedRow;
					}
				}
			}
			if(locals.limits){
				limitsArray=locals.limits;
			}
		}
		
		// Set the title
		$('#title').html('<h1>'+labelsArray.title+'</h1>');
		// Resolve the number of columns
		numCols=(Object.keys(labelsArray.cols).length||1);
		// Set labels in the first row
		$('#signs').append('<h3 class="subheader">'+(labelsArray.cols[0]||'')+'</h3>');
		// Create the array of labels for the values
		for(var i = 1; i<numCols; i++){
			$('#signs').append('<h3 class="subheader">'+labelsArray.cols[i]+'</h3>');
		}		
	}
	
	// Check if the value at given position stay in the limits
	function checkColor(pos){
		if(limitsArray[pos]&&limitsArray[pos].length==2){
			if (valuesArray[pos]<limitsArray[pos][0]) return 'under';
			if (valuesArray[pos]>limitsArray[pos][1]) return 'over';
		}
		return "";
	}
	
	// Arrange the values out of the data object
	function arrangeData(data){
		if(!data || data.length === 0) return;
		
		// Use the last entry of the array; this is arbitrary
		valuesArray = data.pop().values;
		
		// Fill the select box
		for(var i=0; i<parseInt(valuesArray.length/numCols, 10); ++i) {
			$('#sel').append(jQuery('<option />', {'value': i, 
				text: (labelsArray.rows[i]||labelsArray.unnamedRow+' '+(i+1))}));
		}
	}
	
	// Renew the values layout with that out of the data object
	function renewValues(data){
		if(!data || data.length === 0) return;
		
		// Get last line from values-Array
		valuesArray = data.pop().values;

		// Set new values
		var i = $('#sel').val()*2;
		$('#value'+i).removeClass();
		$('#value'+i).text(valuesArray[i]);
		$('#value'+i).addClass(checkColor(i++));
		
		$('#value'+i).removeClass();
		$('#value'+i).text(valuesArray[i]);
		$('#value'+i).addClass(checkColor(i));

	}
	
	$(document).ready(function() {
		// Start progress bar
		NProgress.start();

			var socket = io.connect('http://'+window.location.host+'/data');
			// The first data
			socket.on('first', function(message) {
				if(message === undefined) return;
				
				//arrange labels, limits and data
				arrangeLocals(message.locals);
				arrangeData(message.data);
				

				// Trigger the change to show the values at start
				$('#sel option').eq(firstSelect()).prop('selected', true);
				$('#sel').trigger('change');
				

				// Hide the loading message
				$('#load').fadeOut(undefined, function() {
					// Show the data and finish progress bar
					$('#data').fadeIn(undefined,
						NProgress.done);
				});
				
				// Better interface for the selection box
				$('#sel').customSelect();
			});

			// Next data
			socket.on('data', function(message) {
				if(message === undefined) return;
				renewValues(message.data)
			});
			
			// Handle the Dropdown selection
			$('#sel').on('change', function (e) {
				var i = $(this).val()*2;
				$('#werte').html(jQuery('<h3 />', {'id': 'value'+(i), 'class': checkColor(i), 
					'text': valuesArray[i]}));
				jQuery('<h3 />', {'id': 'value'+(++i), 'class': checkColor(i), 
					'text': valuesArray[i]}).appendTo('#werte');
			});
			
			// Handle the click Button, that leads to the full Table
			$('#toTable').on('click',function(e){
				window.location.search="";
		    });

			// Public stuff
			return {
				socket: socket
			};
	});

})();