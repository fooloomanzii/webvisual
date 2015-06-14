(function(){

  // global Variables
      numCols = 2,        // from config/config.json             // Column Number for Data Values
      labelsArray = [],   // from config/config.json             // Labels Array
      valuesArray = [],   // from Datafile (z.Z. data.txt)       // Data Values Array
      exceedsArray = [],  // will be calculated (boolean Values) // Array for the Exceeds
      dateArray = [];     // will be readout (in Date-Format)    // Array for Timestamps (cf. Lines of Datafile)
      combinedData = [];  // will be created                     // Combining Data
      languageArray = []; // from config/config.json             // Translation of elements in other languages

    // Data Examples:
    //
    // Room          Label        x1      x2    ... (Columns of the Data are numCols)  exc_x1  exc_x2  ...
    // (roomArray)   (labelArray) (valuesArray)                                        (exceedsArray)
    //
    // Raum A        Sauerstoff   3.4     4.5   ...                                    false   false
    // Raum B        Chlor        4.2     2.3   ...                                    true    false
    // Raum A        Chlor        6.2     7.3   ...                                    true    true
    // ....          ....         ...     ...                                          ..      ..


    // further created Elements in the Client-Environment

    // #lastRTime     Label for the Time of the last successful Data Transmission
    // #lastWTime     Label for the Time of the last unsuccessful Data Transmission

    // #dataTimeLabel Label for the Time of the last Message
    // #load          Loading notice


  // Start of the Loading Process
  // (if the Client is ready)
    $(document).ready(function() {
      //TODO Error/Waiting page if connection to sockets is impossible

      // Start of the Server Connection to the Config file
      // (at present "config/config.json")
      var configSocket = io.connect('https://'+window.location.host+'/config', {secure: true});
      var dataSocket = null;

      //***** Receive of Configuration Data
      configSocket.on('data', function(message) {
        if(message === undefined) return; // Check the Existence

        // Waiting Status
        var event = new CustomEvent("dataLoading");
        document.dispatchEvent(event);

        // Function call: Read the Config file
        arrangeLabels(message.locals);

        // Test to send local configuration to an element
        // TODO: Send dynamiccly data-file, logs and configuration to dialogs
        // $('#localConfiguration').text(
        //     JSON.stringify(message.locals));

        // Establish connection to the Data File
        // (if a Config File was read, see above)
        dataSocket = io.connect('https://'+window.location.host+'/data', {secure: true});

        //*** Receiving the first Data
        // (look at copywatch/udpwatch?)
        dataSocket.on('first', function(message) {
          if(message === undefined) return; // Check the Existence

          // Set the Timelabel '#lastRTime'
          // (for the last successful received Data)
          $('#lastRTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));

          // Function Call: Data Arrangement
          arrangeData(message.data, message.exceeds);

          // Hide the Loading Notification
          $('#load').fadeOut(undefined, function() {
            // Displaying in a Progressbar
          });
        });

        //*** Receive another Data
        dataSocket.on('data', function(message) {
          if(message === undefined) return; // Check for Existence

          // Set the Timelabel '#lastRTime'
          // (for the last successful received Data)
          $('#lastRTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));

          // Function Call: Data Renewing
          arrangeData(message.data, message.exceeds);
        });

        //*** Wrong Data
        dataSocket.on('mistake', function(message) {
          // Set the Timelabel '#lastWTime'
          // (for the last unsuccessful received Data)
          $('#lastWTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));
        });
      });

      //***** Return of the Data for public?
      return {
        socket: dataSocket
      };
    });


  //***** Load the Configuration in the Data Object
  function arrangeLabels(locals) {
    if (!locals) { // Check for Existence
      throw new Error("Keine Konfiguration vorhanden");
      return;
    }
    else {
      labelsArray=locals;
    }

    // Set the Title for the '#dataTimeLabel' of the last Message
    $('#dataTimeLabel').text(locals.dataTimeLabel);
    // Set the '#dataTime' of the last Message
    $('#dataTime').text("");

    // Set the Number of different Variables and Columns 'numCols' respectively
    numCols = locals.typeWidth;
    languageArray = locals.language;

    if (numCols < 1) {
      numCols = 1;
    }

    // Create labels for the Value Table 'subtypes'
    for(var j = 0; j<locals.types.lenght; j++){
      for(var i = 1; i<=numCols; i++){
        if (!locals.types[j].subtypes[i-1]) {
          labelsArray.types[j].subtypes.push(
            {"var":locals.unnamedSubtype.var+i,"unit":locals.unnamedSubtype.unit,"threshold":locals.unnamedSubtype.threshold});
        }
      }
    }
  }

  //***** Data Arrangement
  function arrangeData(data, exceeds){
    if(!data || data.length == 0 ) return;  // Check for Existence

    // Set the Arrays of Exceeds 'exceedsArray'
    var exceedsArray = exceeds;

    // Set the Array of Values 'valuesArray' and Array of Timestamps 'dateArray'
    for (var i=0; i<data.length; i++) {
      // If that Data exists, it will be overwritten
      if(valuesArray[i] && dateArray[i]) {
        for (var k=0; k<data[i].values.length; k++) {
          valuesArray[i][k] = data[i].values[k];
        }
        dateArray[i] = $.format.toBrowserTimeZone(
            data[i].date,labelsArray.timeFormat);
      }
      // Otherwise: append the Data to that Arrays
      else {
        valuesArray.push(data[i].values);
        dateArray.push($.format.toBrowserTimeZone(
            data[i].date,labelsArray.timeFormat));
      }

      // Create the Labels for the Type Table 'types', if no Labels are defined in 'config.json'
      // (Room 'room' & Type of the Measurement or other Labels 'kind')

      for(var j = 1; j <= (data[i].values.length / numCols); j++){
        if (!labelsArray.types[j-1]) {
          labelsArray.types.push(
            {"id": labelsArray.unnamedType.id, "room":labelsArray.unnamedType.room,"kind":labelsArray.unnamedType.kind+j,"subtypes":[]});
          for(var k = 1; k<=numCols; k++){
            labelsArray.types[j-1].subtypes.push(
              {"var":labelsArray.unnamedSubtype.var + k,"unit":labelsArray.unnamedSubtype.unit,"threshold":labelsArray.unnamedSubtype.threshold});
          }
        }
      }
    }

    // Join Data to the Object, which is used by the website
    dataStringArray = [];
    for (var i=0; i<dateArray.length; i++) {
      for (var j=0; j<valuesArray[i].length; j++) {
      // l, k are for typed and subtypes
        l = parseInt(j / numCols);
        k = j % numCols;
      // Color picking by Exceeds
        var color = "";
        if (exceedsArray[i][j] === true) {
          color = labelsArray.colors.over;
        }
        else if (exceedsArray[i][j] === false) {
          color = labelsArray.colors.under;
        }
      // head-data of measuring-points
        if(!dataStringArray[j]) {
          dataStringArray.push({"id":      labelsArray.types[l].id.toString(),
                                "room":    labelsArray.types[l].room.toString(),
                                "kind":    labelsArray.types[l].kind.toString(),
                                "var" :    labelsArray.types[l].subtypes[k].var.toString(),
                                "unit":    labelsArray.types[l].subtypes[k].unit.toString(),
                                "data":    [] })
        }
      // .data is the array, in which the measuring time, the value itself and an exceeds-value is stored
        dataStringArray[j].data.push({"date":    dateArray[i].toString(),
                                      "value":   valuesArray[i][j],
                                      "exceeds": exceedsArray[i][j],
                                      "color": color
                                    })
      }
    }

      // Creation of an Object, so it can be assigned to the Eventhandler (dirty)
    var dataStringObject = {content: dataStringArray};

    // Triggering of an Event for the Document 'dataLoaded' to show,
    // that Data Values are ready for the delivery
    var event = new CustomEvent("dataLoaded", { "detail": dataStringArray });
    document.dispatchEvent(event);

      // bind language Array too language selector
    // $('language-element').attr.('data', JSON.stringify(languageArray));
  }



})();
