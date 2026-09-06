# Mentorship: Verifikation für den PR gegen main

Der PR enthält PAT Sans 0.3 und PAT Serif 0.5. Nach dem Alphabet- und Abstandsvergleich wurden die Serifenanschlüsse weicher gezeichnet, die Gewichte leicht reduziert und die Abstände verdichtet. Die Serif verwendet jetzt um 14 Grad geneigte Oblique-Schnitte, deren Formen zum aufrechten Entwurf passen. Die Sans bleibt gegenüber Version 0.3 unverändert. Dieser Bericht trennt lokale Prüfung und Buildabschluss von noch nicht verifizierten privaten Dienstanbindungen.

Der PR umfasst die neue Lernoberfläche, Dashboard und Lernfortsetzung, einheitliche Modulkarten, 21 freigegebene Cover, Lektionsübersicht und PDF-Ansicht, Navigation auf Desktop und Smartphone sowie die abgestimmten Bewegungen. Der Drawer verwendet bei ausreichender Höhe wieder mehr Abstand; unter 740 Pixeln bleibt er kompakter. Kacheln und Liste wechseln mit einer gemeinsamen Animation, ohne Suche oder Fortschritt zurückzusetzen.

Die vorgeschlagene Oberfläche verwendet lokal geladene PAT Sans und PAT Serif, abgeleitet aus Instrument Sans und Source Serif 4 unter OFL. [Herkunft, Eingriffe und Font-Prüfung](MENTORSHIP_FONTS.md) sind dokumentiert. Die privaten Anthropic-Schriften aus dem Designvergleich werden nicht mitgeliefert. Die freigegebenen Modulbilder sind direkt in `lib/mentorship-module-artwork.ts` zugeordnet; die lokale Vorschau ist für ihre Darstellung nicht mehr erforderlich. Weitere Module verwenden ihr gespeichertes Bild oder das Standardmotiv. Es werden keine Kursbilder in der Datenbank überschrieben.

## Lokale Prüfungen

- Vollständiges ESLint und TypeScript bestanden. Nach der letzten Font-Einbindung bestanden die gezielte ESLint-Prüfung und TypeScript erneut.
- Alle 64 Node-Tests bestanden. Sie prüfen unter anderem Lernreihenfolge, offene Lücken, PDF-Lektionen, Platzhalter, Abschluss und Prozentwerte sowie die bestehenden Veröffentlichungs- und Upload-Regeln. Der Upload-Test verwendet einen temporären lokalen HTTP-Server.
- Produktionsbuild `frX2p4hcPrrTsfU0UCKmA` mit Serif 0.5 erfolgreich abgeschlossen, einschließlich TypeScript. Die 64 Node-Tests und das vollständige ESLint stammen aus der vorherigen App-Prüfung; die aktuelle Font-Änderung verändert keine Anwendungslogik.
- `git diff --check` bestanden; alle 21 zugeordneten WebP-Dateien vorhanden.
- Zusätzliche Browserprüfung mit den echten Komponenten, ausschließlich gelesenem Kurskatalog und zunächst Geist/Georgia: Weekly-Kachelansicht bei 1440 Pixeln, mobile Listenansicht im Dark Mode, Menü bei 390 × 844, 320 × 740 und 320 × 667 sowie die Lektionsübersicht bei 320 Pixeln. Alle fünf Weekly-Cover wurden aus der Produktionszuordnung geladen. Keine horizontale Überbreite in den geprüften Kurs- und Lektionsansichten.
- Vorherige Font-Prüfung mit Version 0.3: Schriftvergleich bei 1280 × 800, mobile Kursansicht 390 × 844 in dunkler Darstellung und Menü 320 × 667. Alle fünf Weekly-Bilder geladen, keine horizontale Überbreite; Navigation und Scrollhöhe jeweils 486 Pixel, Indikatoren vollständig sichtbar. Die gesonderte Schriftprobe umfasst lange Absätze, echte Kursivschrift und deutsche Zeichen. Auch die helle Lektionsübersicht bei 320 × 667 bleibt ohne horizontale Überbreite; alle vier Lektionsnamen passen. Die Desktop-Kursansicht wurde zuvor mit Version 0.2 geprüft.
- In allen drei zuvor geprüften Menügrößen blieb „Indikatoren“ ohne Scrollen sichtbar. Auf den beiden höheren Ansichten messen die normalen Zeilen 48 Pixel, bei 667 Pixeln Höhe 44 Pixel. Der lange Core-Content-Titel darf auf zwei Zeilen wachsen.

PAT Serif 0.4: Alle 60 lateinischen und deutschen Buchstaben wurden einzeln visuell betrachtet. Alle 3.600 Kombinationen bestehen in sechs Schnitten die geometrische Abstandskontrolle, mit und ohne Standardligaturen. Die 43.200 Prüfungen sind keine vollständige optische Freigabe jedes Paars; Abstandsgruppen, deutsche Wörter und lange Lesetexte wurden zusätzlich im Browser verglichen. Der neue Desktop-Kursdurchgang bei 1440 × 1000 verwendet normales Serif-Tracking; alle fünf Cover sind geladen und es gibt keine horizontale Überbreite. Die erneute mobile Größenumschaltung für Serif 0.4 ließ sich im abschließenden Browserdurchgang nicht wirksam anwenden; die mobilen Maßangaben oben stammen ausdrücklich aus der Prüfung mit Serif 0.3.

PAT Serif 0.5: Schriftvergleich und Alphabet bei 1280 × 720, Überschriften, deutsche Zeichen, kleine Textgrößen, aufrechter und geneigter Text wurden im Browser geprüft. Die drei Vergleichsspalten zeigen Referenz, 0.4 und 0.5 bei identischer Schriftgröße und normalem Tracking. Die mobile Schriftprobe lädt dieselbe reale Seite in zwei lokalen Fenstern mit nachgemessenen 390 × 844 und 320 × 667 Pixeln. Beide haben keine horizontale Überbreite; die 320-Pixel-Probe wurde zusätzlich in dunkler Darstellung angesehen. Diese Prüfung belegt die responsive Darstellung im Desktop-Browser, nicht das Rendering auf einem physischen Telefon. Der Browser-Schalter zum Ändern der Gesamtgröße wirkte erneut nicht auf den Prüftab, deshalb wurden die festen Fenster verwendet. Alle zwölf Font-Prüfsummen wurden im neuen Produktionsbuild nachgewiesen. Alle 43.200 geometrischen Paarprüfungen bestehen erneut.

Die vorherigen Prüfungen von Suche, Fehler und Wiederholung beim Speichern, PDF-Zuordnung, nächster Lektion, Tastaturfokus, Menü-Wischgeste und unterbrochenem Ansichtswechsel sind in den verlinkten Designberichten dokumentiert. Die abschließende Schriftprüfung ersetzt diese Berichte nicht und ist kein Test auf einem physischen Smartphone.

## Build-Dateigrößen

`npm run measure:mentorship` wertet die von jeder Route referenzierten JavaScript-Dateien des aktuellen Builds aus. Gemeinsame Dateien werden pro Route einmal gezählt. Die Werte messen weder Ladezeit noch tatsächliche Netzwerktransfers.

| Route | JavaScript | gzip | Dateien |
| --- | ---: | ---: | ---: |
| Übersicht | 631.128 B | 182.614 B | 20 |
| Modulübersicht | 657.273 B | 192.216 B | 23 |
| Lektion | 645.398 B | 187.355 B | 22 |
| Indikatoren | 813.806 B | 234.062 B | 24 |

Die zwölf Fontdateien umfassen zusammen 830.712 Bytes. Sie sind nicht Teil dieser JavaScript-Zahlen. `preload: false` lädt nur die tatsächlich verwendeten Schnitte; alle zwölf Dateien wurden anhand ihrer Prüfsummen im Produktionsbuild nachgewiesen.

## Verbleibende Prüfgrenzen

Der Build verwendet Platzhalter für Datenbank, Clerk und Stripe. Erwartete Meldungen zu unerreichbarer Datenbank und Stripe-Verbindung verhindern den Buildabschluss nicht und bestätigen keine Dienstanbindung. Die lokale UI-Prüfung ersetzt Authentifizierung und persönliche Aktionen durch einen Vorschauadapter mit eigener lokaler Fortschrittsdatei.

Private Bunny-Wiedergabe ist durch den lokalen 403 nicht bestätigt. Anmeldung und Mitgliedschaft, tatsächliche Fortschrittsspeicherung, geschützte PDFs und Zahlungsportal bleiben in einer authentifizierten Vorschau mit den regulären Dienstanbindungen zu prüfen. Der PR ändert keine Zugangsdaten, Datenbankschemata, Bunny-Konfiguration oder Veröffentlichungsziele.
