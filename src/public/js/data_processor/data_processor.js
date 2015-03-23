(function(){

  // globale Variablen
      numCols = 2,        // aus config/config.json           // Anzahl der Spalten der Messdaten
      labelsArray = [],   // aus config/config.json           // Array für die Labels
      valuesArray = [],   // aus Datendatei (z.Z. data.txt)   // Array für die Messdaten
      exceedsArray = [],  // wird berechnet (boolean Werte)   // Array für die Über- und Unterschreitungen der Messwerte
      dateArray = [];     // wird ausgelesen (in Date-Format) // Array der Messzeitpunkte (vgl. Zeilen der Messdatei)
      combinedData = [];  // wird erstellt                    // Zusammenlegung der Daten

    // Beispieltabelle aus den Daten:
    //
    // Raum          Label        x1      x2    ... (Spalten der Messdaten ist numCols)  exc_x1  exc_x2  ...
    // (roomArray)   (labelArray) (valuesArray)                                          (exceedsArray)
    //
    // Raum A        Sauerstoff   3.4     4.5   ...                                      false   false
    // Raum B        Chlor        4.2     2.3   ...                                      true    false
    // Raum A        Chlor        6.2     7.3   ...                                      true    true
    // ....          ....         ...     ...                                            ..      ..


    // weitere erzeugte Elemente in der Client-Umgebung:

    // #lastRTime     Zeitlabel für letzte erfolgreiche Datenübermittlung
    // #lastWTime     Zeitlabel für letzte nicht erfolgreiche Datenübermittlung

    // #dataTimeLabel Bezeichner für "letzte Nachricht"
    // #load          Lademeldung


  // Start des Ladevorgangs
  // (wenn der Client bereit ist)
    $(document).ready(function() {

      // Start der Serververbindung zu der Konfigurationsdatei
      // (z.Z. "config/config.json")
      var configSocket = io.connect('http://'+window.location.host+'/config');
      var dataSocket = null;

      //***** Empfangen der Daten und Konfigurationen
      configSocket.on('data', function(message) {
        if(message === undefined) return; // Prüfung auf Existenz

        // Funktionsaufruf: Auslesen der Konfigurationsdatei
        arrangeLabels(message.locals);

        // Verbindungsaufbau zur Datendatei
        // (wenn eine Konfigurationsdatei gelesen werden konnte, siehe oben)
        dataSocket = io.connect('http://'+window.location.host+'/data');

        // Wartestatus
        dataSocket.on('wait', function() {
          // (Lademeldung) #load
          $('#load').text("Lade Daten...");
        });

        //*** Empfang der ersten Daten
        // (siehe copywatch?)
        dataSocket.on('first', function(message) {
          if(message === undefined) return; // Prüfung auf Existenz

          // Setzen des Zeitlabels '#lastRTime'
          // (für letzte erfolgreich empfangene Daten)
          $('#lastRTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));

          // Funktionsaufruf: Anordnung der Daten
          arrangeData(message.data, message.exceeds);

          // Ausblenden der Lademeldung
          $('#load').fadeOut(undefined, function() {
            // Anzeige in einer Progressbar
          });
        });

        //*** Empfang weiterer Daten
        dataSocket.on('data', function(message) {
          if(message === undefined) return; // Prüfung auf Existenz

          // Setzen des Zeitlabels '#lastRTime'
          // (für letzte erfolgreich empfangene Daten)
          $('#lastRTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));

          // Funktionsaufruf: Erneuerung der Daten
          arrangeData(message.data, message.exceeds);
        });

        //*** Fehlerhafte Daten
        dataSocket.on('mistake', function(message) {
          // Setzen des Zeitlabels '#lastWTime'
          // (für letzte nicht erfolgreich empfangene Daten)
          $('#lastWTime').text(
              $.format.toBrowserTimeZone(message.time,labelsArray.timeFormat));
        });
      });

      //***** Rückgabe von Werten für public?
      return {
        socket: dataSocket
      };
    });


  //***** Laden der Konfiguration in das Datenobjekt
  function arrangeLabels(locals) {
    if (!locals) {
      throw new Error("Keine Konfiguration vorhanden"); // Prüfung auf Existenz
      return;
    }
    else {
      labelsArray=locals;
    }

    // Setzen des Bezeichners für "letzte Nachricht" '#dataTimeLabel'
    $('#dataTimeLabel').text(locals.dataTimeLabel);
    // Setzen des Bezeichners für "letzte Nachricht" '#dataTimeLabel'
    $('#dataTime').text("");

    // Setzen der Anzahl der verschiedenen Variablen bzw. Spalten 'numCols'
    numCols = locals.typeWidth;

    if (numCols < 1) {
      numCols = 1;
    }

    // Erzeugen der Labels für die Wertetabelle 'subtypes'
    for(var j = 0; j<locals.types.lenght; j++){
      for(var i = 1; i<=numCols; i++){
        if (!locals.types[j].subtypes[i-1]) {
          labelsArray.types[j].subtypes.push(
            {"var":locals.unnamedSubtype.var+i,"unit":locals.unnamedSubtype.unit,"threshold":locals.unnamedSubtype.threshold});
        }
      }
    }
  }

  //***** Anordnung der Daten
  function arrangeData(data, exceeds){
    if(!data || data.length == 0 ) return;  // Prüfung auf Existenz

    // Setzen des Über- oder Unterschreitungsarrays 'exceedsArray'
    var exceedsArray = exceeds;

    // Lesen der letzten Zeile der Messdatei

    // Setzen des Datenarrays 'valuesArray' und Messzeitarray 'dateArray'
    for (var i=0; i<data.length; i++) {
        // Wenn schon Daten existieren, werden diese überschrieben
      if(valuesArray[i] && dateArray[i]) {
        for (var k=0; k<data[i].values.length; k++) {
          valuesArray[i][k] = data[i].values[k];
        }
        dateArray[i] = $.format.toBrowserTimeZone(
            data[i].date,labelsArray.timeFormat);
      }
        // Ansonsten, werden die Daten an die Arrays angefügt
      else {
        valuesArray.push(data[i].values);
        dateArray.push($.format.toBrowserTimeZone(
            data[i].date,labelsArray.timeFormat));
      }

      // Erzeugen der Labels für die Typentabelle 'types', wenn keine Labels in der 'config.json' definiert sind
      // (Raum 'room' & Typ der Messung oder andere Bezeichnung 'kind')
      for(var j = 1; j <= (data[i].values.length / numCols); j++){
        if (!labelsArray.types[j-1]) {
          labelsArray.types.push(
            {"room":labelsArray.unnamedType.room,"kind":labelsArray.unnamedType.kind+j,"subtypes":[]});
          for(var k = 1; k<=numCols; k++){
            labelsArray.types[j-1].subtypes.push(
              {"var":labelsArray.unnamedSubtype.var + k,"unit":labelsArray.unnamedSubtype.unit,"threshold":labelsArray.unnamedSubtype.threshold});
          }
        }
      }
    }

    // 1. Zusammenführung in 'combinedData'
    combinedData = {labels: labelsArray.types, colors: labelsArray.colors, data: []}
    for (var i=0; i<data.length; i++) {
      combinedData.data.push({"date" : dateArray[i],
                              "values" : valuesArray[i],
                              "exceeds" : exceedsArray[i]});
    }

    // 2. Erzeugen eines einzigen Arrays mit allen Messpunkten
    var dataStringArray = [];
    for (var i=0; i<data.length; i++) {
      for (var j=0; j<labelsArray.types.length; j++) {
        for (var k=0; k<numCols; k++) {
          if (labelsArray.types[j] && valuesArray[i][j*numCols+k]) {
            var color = "";
            var exceeds = "";
            if (exceedsArray[i][j*numCols+k] === true) {
              color = labelsArray.colors.over;
              var exceeds = true;
            }
            else if (exceedsArray[i][j*numCols+k] === false) {
              color = labelsArray.colors.under;
              var exceeds = false;
            }
            dataStringArray.push({"date"   : dateArray[i].toString(),
                                  "room"   : labelsArray.types[j].room.toString(),
                                  "kind"   : labelsArray.types[j].kind.toString(),
                                  "var"    : labelsArray.types[j].subtypes[k].var.toString(),
                                  "value"  : valuesArray[i][j*numCols+k],
                                  "unit"   : labelsArray.types[j].subtypes[k].unit.toString(),
                                  "color"  : color.toString(),
                                  "exceeds": exceeds});
          }
        }
      }
    }
      // erzeugen eines Objects, damit es dem Eventhandler zugeordnet werden kann (dirty)
    var dataStringObject = {content: dataStringArray};

    // Triggering von einem Event zum Document 'dataLoaded', um zu zeigen,
    // dass die Daten bereit sind und die Daten zu übergeben
    $(document).triggerHandler("dataLoaded", dataStringObject);
  }



})();
