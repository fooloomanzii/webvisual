(function(){
  'use strict';

  var numCols,
    labelsArray={ //default-Values
      "dataTimeLabel":"Last Time",
      "timeFormat":"dd.MM.yyyy HH:mm:ss",
      "PageTitle":"Table",
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
      if(locals.dataTimeLabel){
        labelsArray.dataTimeLabel=locals.dataTimeLabel;
      }
      if(locals.timeformat){
        labelsArray.timeFormat=locals.timeFormat;
      }
      if(locals.table){
        if(locals.table.title){
          labelsArray.pageTitle=locals.table.title;
        }
        if(locals.table.colors){
          if(locals.table.colors.under) {
            $('body').prepend('<style> .under { color: ' + 
                locals.table.colors.under + ' } </style>');
          }
          if(locals.table.colors.over) {
            $('body').prepend('<style> .over { color: ' + 
                locals.table.colors.over + ' } </style>');
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
    
    // Set the title of the Page
    document.title=labelsArray.pageTitle;
    // Set the local title
    $('#title').text(labelsArray.title);
    // Date & Time from the last Message
    $('#dataTimeLabel').text(labelsArray.dataTimeLabel)
    $('#dataTime').text("...");
    
    // Resolve the number of columns
    numCols=(Object.keys(labelsArray.cols).length||1);
    
    // Clear the Table
    $('#valueTable').html('<tbody id="valueTBody"></tbody>');
    $('#valueTBody').html('<tr id="valCols"></tr>');
    $('#valCols').html('<th id="valCorner" class="valGroup"></th>');
    
    // Set labels in the first row
    $('#valCorner').append('<h3 class="sub">'+labelsArray.corner+'</h3>');
    $('#valCols').append('<th><h3 class="subheader">' +
        (labelsArray.cols[0]||'') + '</h3></th>');
    // Create the array of labels for the values
    for(var i = 1; i<numCols; i++){
      $('#valCols').append('<th><h3 class="subheader">' +
          labelsArray.cols[i] + '</h3></th>');
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
    if(!data || data.length == 0 ) return;
    
    var tmp;
    data=data.pop();

    // Use the last entry of the array; this is arbitrary
    valuesArray = data.values;
    $('#dataTime').text($.format.toBrowserTimeZone(
        data.date,labelsArray.timeFormat));

    // Create the table
    for(var i=0; i<parseInt(valuesArray.length/numCols, 10); ++i) {
      tmp='<tr class="valRow" value="'+i+'">'+
      '<th class="valGroup"><h3 class="subheader">'+
      (labelsArray.rows[i]||labelsArray.unnamedRow+' '+(i+1))+'</h3></th>';
      for(var j=numCols*i; j<numCols*(i+1);j++){
        tmp+='<td><h3 id="value'+j+'" class="'+checkColor(j)+'">'+
        valuesArray[j]+'</h3></td>';
      }
      tmp+='</tr>';
      $('#valueTBody').append(tmp);
    }
  }
  
  // Renew the values layout with that out of the data object
  function renewValues(data){
    if(!data || data.length == 0 ) return; 
    data=data.pop();
    
    valuesArray = data.values;
    $('#dataTime').text($.format.toBrowserTimeZone(
        data.date,labelsArray.timeFormat));

    // Change the values
    for(var i=0; i<valuesArray.length; i++) {
      if($('#value'+i)){
        $('#value'+i).removeClass();
        $('#value'+i).text(valuesArray[i]);
        $('#value'+i).addClass(checkColor(i));
      }
    }
  }

  $(document).ready(function() {
    // Start progress bar
    NProgress.start();

    var configSocket = io.connect('http://'+window.location.host+'/config');
    
    // Receive the data
    configSocket.on('data', function(message) {
      if(message === undefined) return;
      // Arrange labels and limits
      arrangeLocals(message.locals);
    });
    
    var dataSocket = io.connect('http://'+window.location.host+'/data');
    
    // Waiting status
    dataSocket.on('wait', function() {
      // Change the loading message
      $('#load').text("Seit Start des Servers war noch nichts empfangen...")
    })
    
    // The first data
    dataSocket.on('first', function(message) {
      if(message === undefined) return;
      
      // Set the time Label
      $('#lastRTime').text(
          $.format.toBrowserTimeZone($.now(),labelsArray.timeFormat))

      // Arrange the received data
      arrangeData(message.data);
      
      $('.valRow').on('click', function (e) {
        window.location.search='?type=select&value='+$(this).attr('value');
      });

      // Hide the loading message
      $('#load').fadeOut(undefined, function() {
        // Show the data and finish progress bar
        $('#dataTimeForm').fadeIn(undefined);
        $('#data').fadeIn(undefined, NProgress.done);
      });
    });
    
    // Next data
    dataSocket.on('data', function(message) {
      if(message === undefined) return;
      
      // Set the time Label
      $('#lastRTime').text(
          $.format.toBrowserTimeZone($.now(),labelsArray.timeFormat))
      
      renewValues(message.data);
    });
    
    // Mistaken data
    dataSocket.on('mistake', function() {
      // Set the time Label
      $('#lastWTime').text(
          $.format.toBrowserTimeZone($.now(),labelsArray.timeFormat))
    })
    
    // Public stuff
    return {
      socket: dataSocket
    };
  });

})();