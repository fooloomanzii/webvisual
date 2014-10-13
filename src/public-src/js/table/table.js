(function(){
  'use strict';

  var numCols,
    labelsArray,
    valuesArray,
    exceedsArray;
  
  // Arrange locals from Configuration data out of the data object
  function arrangeLocals(locals){
    if(locals){
      labelsArray=locals;
      $('body').prepend('<style> .under { color: ' + 
          locals.colors.under + ' } </style>');
      $('body').prepend('<style> .over { color: ' + 
          locals.colors.over + ' } </style>');
    } else {
      //TODO some message;
      throw new Error("No locals received!");
    }
    
    // Set the title of the Page
    document.title=labelsArray.table.pageTitle;
    // Set the local title
    $('#title').text(labelsArray.table.title);
    // Date & Time from the last Message
    $('#dataTimeLabel').text(labelsArray.dataTimeLabel);
    $('#dataTime').text("...");

    // Clear the Table
    $('#valueTable').html('<tbody id="valueTBody"></tbody>');
    $('#valueTBody').html('<tr id="valCols"></tr>');
    $('#valCols').html('<th id="valCorner" class="valGroup"></th>');
    
    // Resolve the number of columns
    numCols=labelsArray.data.typeWidth;
    
    // Set labels in the first row
    $('#valCorner').append('<h3 class="sub">'+labelsArray.table.corner+'</h3>');
    if(numCols<1) numCols=1;
    // Create the array of labels for the values
    for(var i = 0; i<numCols; i++){
      $('#valCols').append('<th><h3 class="subheader">' +
          (labelsArray.data.subtypes[i]||i+1) + '</h3></th>');
    }  
  }
  
  // Check if the value at given position stay in the limits
  function checkColor(pos){
    if(exceedsArray && exceedsArray.length==2){
      if (exceedsArray[0][pos]) return 'under';
      if (exceedsArray[1][pos]) return 'over';
    }
    return "";
  }
  
  // Handle the exceeds and if there any, show them
  //be sure, that exceedsArray was initialized
  function showExceeds(){
    var exceedsHTML="";
    var i;
    var pos = $.inArray(true,exceedsArray[0]);
    if(pos > -1){ 
      exceedsHTML += "Under the threshold:<br><ul>";
      while(pos > -1){
        exceedsHTML+="<li>";
        i=parseInt(pos/numCols, 10);
        exceedsHTML+=(labelsArray.data.types[i]||labelsArray.table.unnamedRow+' '+(i+1));
        exceedsHTML+=", "+(labelsArray.data.subtypes[pos%numCols]||(pos%numCols)+1);
        exceedsHTML+=": "+valuesArray[pos]+";<br>";
        exceedsHTML+="</li>";
        pos = $.inArray(true,exceedsArray[0],pos+1);
      }
      exceedsHTML+="</ul>";
    }
    pos = $.inArray(true,exceedsArray[1]);
    if(pos > -1){ 
      exceedsHTML += "Over the threshold:<br><ul>";
      while(pos > -1){
        exceedsHTML+="<li>";
        i=parseInt(pos/numCols, 10);
        exceedsHTML+=(labelsArray.data.types[i]||labelsArray.table.unnamedRow+' '+(i+1));
        exceedsHTML+=", "+(labelsArray.data.subtypes[pos%numCols]||(pos%numCols)+1);
        exceedsHTML+=": "+valuesArray[pos]+";<br>";
        exceedsHTML+="</li>";
        pos = $.inArray(true,exceedsArray[1],pos+1);
      }
      exceedsHTML+="</ul>";
    }
    $('#exceeds').html(exceedsHTML);
    if(exceedsHTML) $('#excLink').click();
  }
  
  // Arrange the values out of the data object
  // be sure, that labelsArray was initialized
  function arrangeData(data, exceeds){
    if(!data || data.length == 0 ) return;
    
    var tmp;
    
    // Get the threshold exceeds
    exceedsArray = exceeds;

    // Use the last entry of the array; this is arbitrary
    data=data.pop();
    valuesArray = data.values;
    $('#dataTime').text($.format.toBrowserTimeZone(
        data.date,labelsArray.timeFormat));

    // Create the table
    for(var i=0; i<parseInt(valuesArray.length/numCols, 10); ++i) {
      tmp='<tr class="valRow" value="'+i+'">'+
      '<th class="valGroup"><h3 class="subheader">'+
      (labelsArray.data.types[i]||labelsArray.table.unnamedRow+' '+(i+1))+'</h3></th>';
      for(var j=numCols*i; j<numCols*(i+1);j++){
        tmp+='<td><h3 id="value'+j+'" class="'+checkColor(j)+'">'+
        valuesArray[j]+'</h3></td>';
      }
      tmp+='</tr>';
      $('#valueTBody').append(tmp);
    }
  }
  
  // Renew the values layout with that out of the data object
  function renewValues(data, exceeds){
    if(!data || data.length == 0 ) return; 
    
    data=data.pop();
    
    valuesArray = data.values;
    exceedsArray = exceeds;
    showExceeds();
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
    var dataSocket = null;
    
    // Receive config data (labels etc.)
    configSocket.on('data', function(message) {
      if(message === undefined) return;
      // Arrange labels and limits
      arrangeLocals(message.locals);
      
      // Connect to data socket only if config data is received
      dataSocket = io.connect('http://'+window.location.host+'/data');

      // Waiting status
      dataSocket.on('wait', function() {
        // Change the loading message
        $('#load').text("Seit Start des Servers war noch nichts empfangen...");
      });
      
      // The first data
      dataSocket.on('first', function(message) {
        if(message === undefined) return;
        
        // Set the time Label
        $('#lastRTime').text(
            $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));

        // Arrange the received data
        arrangeData(message.data, message.exceeds);
        
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
            $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));
        
        renewValues(message.data, message.exceeds);
      });
      
      // Mistaken data
      dataSocket.on('mistake', function(message) {
        // Set the time Label
        $('#lastWTime').text(
            $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));
      });
    });
    
    // Public stuff
    return {
      socket: dataSocket
    };
    
  });

})();