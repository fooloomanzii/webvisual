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
		$('#valCorner').append('<h3 class="sub">'+labelsArray.corner+'</h3>');
		$('#valCols').append('<th><h3 class="subheader">'+(labelsArray.cols[0]||'')+'</h3></th>');
		// Create the array of labels for the values
		for(var i = 1; i<numCols; i++){
			$('#valCols').append('<th><h3 class="subheader">'+labelsArray.cols[i]+'</h3></th>');
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
		var tmp;

		// Use the last entry of the array; this is arbitrary
		valuesArray = data.pop().values;

		// Create the table
		for(var i=0; i<parseInt(valuesArray.length/numCols, 10); ++i) {
			tmp='<tr class="valRow" value="'+i+'">'+
			'<th class="valGroup"><h3 class="subheader">'+(labelsArray.rows[i]||labelsArray.unnamedRow+' '+(i+1))+'</h3></th>';
			for(var j=numCols*i; j<numCols*(i+1);j++){
				tmp+='<td><h3 id="value'+j+'" class="'+checkColor(j)+'">'+valuesArray[j]+'</h3></td>';
			}
			tmp+='</tr>';
			$('#valueTBody').append(tmp);
		}
	}
	
	// Renew the values layout with that out of the data object
	function renewValues(data){
		if(!data || data.length === 0) return;
		
		valuesArray = data.pop().values;

		// Change the values
		for(var i=0; i<valuesArray.length; i++) {
			if($('#value'+i)){
				$('#value'+i).removeClass();
				$('#value'+i).addClass(checkColor(i));
			}
		}
	}

	$(document).ready(function() {
		// Start progress bar
		NProgress.start();

		var socket = io.connect('http://'+window.location.host+'/data')
		// The first data
		socket.on('first', function(message) {
			if(message === undefined) return;

			//arrange labels, limits and data
			arrangeLocals(message.locals);
			arrangeData(message.data);
			
			$('.valRow').on('click', function (e) {
				window.location.search='?type=select&value='+$(this).attr('value');
			});

			// Hide the loading message
			$('#load').fadeOut(undefined, function() {
				// Show the data and finish progress bar
				$('#data').fadeIn(undefined,
						NProgress.done);
			});
		});
		
		// Next data
		socket.on('data', function(message) {
			if(message === undefined) return;
			renewValues(message.data);
		});
		
		// Public stuff
		return {
			socket: socket
		};
	});

})();