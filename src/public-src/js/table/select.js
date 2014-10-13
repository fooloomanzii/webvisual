(function(){
  'use strict';
  
  var numCols,
    labelsArray,
    valuesArray,
    exceedsArray,
    sel;

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
      labelsArray=locals
      $('body').prepend('<style> .under { color: ' + 
          locals.colors.under + ' } </style>');
      $('body').prepend('<style> .over { color: ' + 
          locals.colors.over + ' } </style>');
    } else {
      //TODO some message;
    }
  
    // Set the title of the Page
    document.title=labelsArray.table.pageTitle;
    // Date & Time from the last Message
    $('#dataTimeLabel').text(labelsArray.dataTimeLabel)
    $('#dataTime').text("...");
    
    // Clear the Table
    $('#valueTable').html('<tr id="tableHead"></tr><tr id="valCols"></tr>');
    $('#tableHead').html('<td><a id="toTable" class="custom button">Full Table</a></td>');
    
    $('#tableHead').append('<td><select id="sel"></select></td>');
    
    $('#valCols').html('<td id="signs"></td><td id="werte"></td>');  
    
    // Resolve the number of columns
    numCols=labelsArray.data.typeWidth;
    if(numCols<1) numCols=1;
    // Create the array of labels for the values
    for(var i = 0; i<numCols; i++){
      $('#signs').append('<h3 class="subheader">'+ (labelsArray.data.subtypes[i]||i+1)+'</h3>');
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
  
//Handle the exceeds and if there any, show them
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
        exceedsHTML+=", "+(labelsArray.data.subtypes[pos%numCols]||(pos%numCols)+1)+";<br>";
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
        exceedsHTML+=", "+(labelsArray.data.subtypes[pos%numCols]||(pos%numCols)+1)+";<br>";
        exceedsHTML+="</li>";
        pos = $.inArray(true,exceedsArray[1],pos+1);
      }
      exceedsHTML+="</ul>";
    }
    $('#exceeds').html(exceedsHTML);
    if(exceedsHTML) $('#excLink').click();
  }
  
  // Arrange the values out of the data object
  function arrangeData(data, exceeds){
    if(!data || data.length === 0) return;
    
    // Get the threshold exceeds
    exceedsArray = exceeds;
    
    // Use the last entry of the array; this is arbitrary
    valuesArray = data.pop().values;
    // Clear the old values
    $('#sel').html("");
    
    // Fill the select box
    for(var i=0; i<parseInt(valuesArray.length/numCols, 10); ++i) {
      $('#sel').append(jQuery('<option />', {'value': i, 
        text: (labelsArray.data.types[i]||labelsArray.table.unnamedRow+' '+(i+1))}));
    }
  }
  
  // Renew the values layout with that out of the data object
  function renewValues(data, exceeds){
    if(!data || data.length === 0) return;
    
    // Get the threshold exceeds
    exceedsArray = exceeds;
    showExceeds();
    
    // Get last line from values-Array
    valuesArray = data.pop().values;

    // Set new values
    var i = $('#sel').val()*2;
    $('#value'+i).removeClass();
    $('#value'+i).text(valuesArray[i]);
    $('#value'+i).addClass(checkColor(i));
    i++;
    $('#value'+i).removeClass();
    $('#value'+i).text(valuesArray[i]);
    $('#value'+i).addClass(checkColor(i));

  }
  
  $(document).ready(function() {
    // Start progress bar
    NProgress.start();
      
      var configSocket = io.connect('http://'+window.location.host+'/config');
      var dataSocket;
      
      // Receive config data (labels etc.)
      configSocket.on('data', function(message) {
        if(message === undefined) return;
        // Arrange labels and limits
        arrangeLocals(message.locals);
        
     // Connect to the data socket only if config data is received
        dataSocket = io.connect('http://'+window.location.host+'/data');
        // The first data
        dataSocket.on('first', function(message) {
          if(message === undefined) return;
          
          // Set the time Label
          $('#lastRTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat))
              
          // Arrange the data
          arrangeData(message.data, message.exceeds);
          
          // Trigger the change to show the values at start
          $('#sel option').eq(firstSelect()).prop('selected', true);
          $('#sel').trigger('change');
            
          // Better interface for the selection box
          if($('.customSelect').length <= 0) $('#sel').customSelect();

          // Hide the loading message
          $('#load').fadeOut(undefined, function() {
            // Show the data and finish progress bar
            $('#data').fadeIn(undefined,
              NProgress.done);
          });
        });

        // Next data
        dataSocket.on('data', function(message) {
          if(message === undefined) return;
          
          // Set the time Label
          $('#lastRTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat))
              
          renewValues(message.data, message.exceeds)
        });  
        
        // Mistaken data
        dataSocket.on('mistake', function(message) {
          // Set the time Label
          $('#lastWTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat))
        });
      
        // Handle the Button, that leads to the full Table
        $('#toTable').on('click',function(e){
          window.location.search="";
          });
        
        // Handle the Dropdown selection
        $('#sel').on('change', function (e) {
          //C hange the title of the Page
          document.title=labelsArray.table.pageTitle+" - "+$('#sel option:selected').text();
          // Change the local title
          $('#title').text(labelsArray.table.title+" - "+$('#sel option:selected').text());
          var i = $(this).val()*2;
          $("#werte").html($('<h3 />', {'id': 'value'+i, 'class': checkColor(i), 
            'text': valuesArray[i]}));
          $('<h3 />', {'id': 'value'+(++i), 'class': checkColor(i), 
            'text': valuesArray[i]}).appendTo('#werte');
        });
      });
      

      // Public stuff
      return {
        socket: dataSocket
      };
  });

})();