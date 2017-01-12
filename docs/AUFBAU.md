# Projekt

Die Aufgabe des Projekts „webvisual" ist es, Änderungen einer CSV-Datei zu detektieren und durch einen selbsterzeugten Server über das Netzwerk die Zustände der Messgeräte über eine Webseite zu visualisieren.

## Grundaufbau

Der entsprechende Server ist auf Basis der Node-JS-Plattform in JavaScript entstanden und beinhaltet verschiedene Module. Überbau ist eine bestimmte Node-JS-Umgebung („electron"), die eine GUI mittels einer eigenen „Chromium"-Laufzeitumgebung erzeugt und der Steuerung des Servers dient. Die Steuerung ist unter anderem eventbasiert, das heißt sie ist in der Regel vom Standard- Node-JS-Modul „EventEmitter" abhängig. Die Verbindung zu den Clients wird über Websockets innerhalb einer Browserumgebung hergestellt.

## Wichtige Module für node-js

- ##### main-module (src/main.js)

  Dieses Modul dient dem Grundaufbau der Anwendung, dem Erzeugen der Basisklassen und der Vermittlung zwischen der GUI, die selbst eine Webseite darstellt, und der Steuerung der Serverprozesse. Wenn beispielsweise eine neue Konfigurationsdatei hinzugefügt wird, werden die entsprechenden Informationen über den Prozessaustauschenkanal (hier „ipc-Renderer") verschickt und durch dieses Modul ausgewertet. Auch werden über dieses Modul die Benutzerdaten geladen und gespeichert, die Informationen zu den Authentifizierungseinstellungen, Rendereinheiten, Messgerätebeschreibungen und den Servereinstellungen enthalten.

- ##### server-module (src/server.js)

  Über das Servermodul wird aus den übergebenen Einstellungen ein http-Server und gegebenenfalls einen https-Server erzeugt. Ob dies der Fall ist, hängt davon ab, ob die Pfade zum public key, zum private key, zur certificate chain und zur passphrase existieren und gültig sind. Zum anderen wird hier die Datenmodul- und die Routerklasse erzeugt. Sollte die Datenmodulklasse eine Änderung an der Konfiguration vermelden, erzeugt dieses Modul entsprechende Events, die die Routingeinstellungen neusetzen.

- ##### router-module (src/router/index.js))

  Durch das Router-Modul wird die Zuordnung der entsprechenden Templates, hier „jade", und den Benutzeranfragen gesetzt. In jedem Fall setzt das Modul das Login-Template (/login), durch welches sich ein Benutzer anmeldet und authentifiziert, und das Index-Template (/index), welches eine Auflistung der vorhandenen Messkonfiguration erzeugt und eine Weiterleitung auf eben jene generiert. Durch das /logout-Routing wird der Benutzer abgemeldet und wieder auf das /login-Template geleitet. Ebenfalls wird i diesem Module die Authentifizierung der Benutzer überprüft. Da dies im Institut der gewählte Weg der Identifizierung ist wird eine Verbindung mittels ActiveDirectory zu einem ldap-Server hergestellt, und mittels der vom Benutzer auf dem /login-Seite angegebenen Benutzernamen und -passwort überprüft, ob sich der Benutzer in der Organisationsstruktur des erlaubten Bereichs befindet und sich über den ldap-Server authentifizieren ließe, was zur Weiterleitung auf die /index-Seite führt.

- ##### data-module (src/data_module/index.js)

  Das data-Module baut auf mehreren Modulen auf, die Websockets für die Clients erzeugen, eine Messraumbeschreibungsdatei auslesen und auf Veränderungen überwachen, die Messdatei auslesen und überwachen, Veränderungen den Messgeräte zuordnen und an verbundene Clients verschicken. Bestimmte Teile starten sich gegebenenfalls selbstständig neu, wenn Veränderungen an den Konfigurationsdateien detektiert wurden.

  - ###### filewatch-module (src/data_module/filehandler/filewatch/index.js)

    Dieses Modul überwacht Dateien auf Veränderungen. Es gibt verschiedene Modi wie dies geschehen soll. Der Modus "append" überwacht Änderungen am Dateianfang, der Modus "prepend" Änderungen am Dateiende, der Modus "all" übergibt den gesamten Dateiinhalt bei Änderung der Datei und der Modus "json" überwacht eine JSON-Datei auf Änderung und Richtigkeit. Dieses Modul basiert auf einem Modul (copywatch), dass ein Vorgänger erzeugt hatte aber durch mich neuaufgebaut worden ist, wie zum Beispiel in dem ich das Überwachungstool "watchr" durch das aktuellere "chokidar" ausgetauscht habe, da dies auch atomare Schreibvorgänge berücksichtigen kann und die Möglichkeit der Überwachung von JSON-Dateien mit eingeführt habe, um eine leichtere Überwachung von Konfigurationen zu ermöglichen.

  - ###### dataparser-module (src/data_module/filehandler/dataparser/index.js)

    Dieses Modul wandelt mittels Regulärer Ausdrücke zeilenweise Daten des filewatch-Moduls um, wie Messdatum und Messwerte. Die Messraumbeschreibung definiert welches Datums- und Zahlenformat vorliegt.

  - ###### dataMerge-module (src/data_module/filehandler/dataMerge.js)

    Dieses Modul ordnet die geparseten Werte den Messgeräten zu und bestimmt, ob sich Messwerte in Grenzbereichen befinden.

  - ###### settings-module (src/data_module/filehandler/settings/)

    Das settings-Modul überwacht Änderungen einer Messraumbeschreibungsdatei, die definiert, welchen Pfad die Messdatei hat, welche Informationen der Benutzer auf der Website über das Messgerät erfährt, in welchen Messbereich die Alarmzustände liegen, ob das Messgerät einzig ein Alarmgeber ist, Bilddateien zuordnet, etc.. Findet eine Änderung an der Datei statt, wird diese neuausgelesen und ein Konfigurationsobjekt erzeugt, dass dem data-Modul und über geordnet auch dem router-Modul geschickt wird. Zu Teilen werden Prozesse dadurch automatisch neugestartet, da sich durch Umbenennungen verschiedene Zuordnungen ändern können oder auch durch einen anderen Pfad zur Messdatei, die zugehörige Überwachung re-initialisiert werden muss.

  - ###### cache-module (src/data_module/cache/index.js)

    Dieses Modul erzeugt einen Zwischenspeicher, der es ermöglicht, an Benutzer zurückliegende Dateiänderungen über den Websocket zu schicken. Sollte eine durch die Konfiguration festgelegte Grenze erreicht sein, werden die ältesten Daten gelöscht.

- ##### view-Ordner (src/views)

  In diesem Ordner befinden sich die Rendereinheiten (src/views/renderer), die den Clients verschiedene Darstellungsmöglichkeiten der Daten ermöglichen (zurzeit ein Alarmansicht und eine Graphenansicht). Die Rendereinheiten sind in der Templatebeschreibung "jade" bzw. "pug" geschrieben, die es ermöglicht, die Messraumkonfiguration in die gerenderte Ansicht dynamisch mit einzubeziehen und sie aufzubauen. Durch diese Form lassen sich auch sogenannte "mixins" erzeugen, die Header oder häufig verwendeten Code entsprechend vereinfacht einfügen lassen. Ebenso befinden sich hier die Templates für den "login" und den "index".

## Aufbau der Messraumbeschreibung

Eine Messraumkonfiguration zur Dateiüberwachung ist im json-Format verfasst. Die oberste Ebene besteht aus Schlüsseln, die den Namen, der entsprechenden Konfiguration angeben, die auch in der index-Ansicht angezeigt wird. Es ist möglich mehrere Konfigurationen einer Beschreibung zuzuordnen, damit mehrere Messanlagen einer Routingadresse zugeordnet werden können. Die nächste Ebene beinhaltet verschiedene Schlüsselwerte:

- "connections" beschreibt die Messdatei, ihren Pfad, welcher Teil der Datei überwacht werden soll, welches Format Datum und Zahlen haben und ob bestimmte Kopfzeilen ignoriert werden sollen.
- "locals" beschreibt die Bezeichner der Messwerte, wobei "types" die einzelnen Typen beschreibt und "ignore", ob bestimmte Elemente in der Darstellung und Auswertung ausgelassen werden sollen.
- "types" ist ein Array und die Elemente bestehen aus einem Eintrag für eine "id", für die Grenzwerte ("threshold"), für Bezeichner, die der Client auf der Website sehen kann ("keys"), für die Messgröße ("unit") und ob es sich um einen einzigen Alarmgeber handelt ("isBoolean").
- "unnamedType" beschreibt, wie unbenannte Schlüssel von Typen benannt werden.
- "groupingKeys" beschreiben die Schlüssel der "keys", die dafür benutzt werden, um eine Gruppierung der Elemente in der Darstellung zu erzeugen. Die Gruppennamen sind die entsprechenden Schlüsselwerte der Elemente
- "preferedGroupingKey": beschreibt den Schlüssel, der in der initialen Gruppierung benutzt wird, also wenn die Website zuerst geöffnet ist.
- "exclusiveGroups" beschreibt die Schlüssel und Namen der Elemente (bezüglich ihrer ids), die in bestimmten Gruppen einsortiert sind. Die Gruppennamen sind hier die angegebenen Namen.
