# Lektionspräsentation, mobile Cover und Menügesten

Stand: 6. September 2026. Private Vorschau; kein Produktionsrelease.

## Ergebnis

- Modulseiten setzen die bereits abgestimmte Kartenpräsentation fort. Kopf, Fortschritt und Kapitel geben den Auftakt; Lektionszeilen erscheinen nacheinander. Player und Aktionen ergänzen die Ankunft.
- Die mobile Listenansicht gibt den vorhandenen Bildern 36 Prozent der Kartenbreite, mindestens 108 Pixel. Gleich hohe Zeilen und getrennte Fortschrittsspalten halten die Liste ruhig.
- Der Hover-Schatten großer Karten liegt mit `0 4px 12px -3px` näher an der Karte. Er blendet weiterhin über 280 Millisekunden ein und aus.
- Ein deutlicher Wisch nach links schließt das offene mobile Menü. Feine Linien unterscheiden Community/eigene Seiten, Videoserien und Indikatoren in der bestehenden Reihenfolge.

## Verhalten und Umsetzung

Die Lektionspräsentation verwendet die bestehende CSS-Animation mit 280 Millisekunden Dauer und 8 Pixeln Bewegung. Der Kopf beginnt sofort, Fortschritt nach 40 und Kapitelüberschriften ab 60 Millisekunden. Die erste Lektionszeile beginnt nach 100 Millisekunden; jede weitere nach zusätzlichen 35 Millisekunden, begrenzt auf 275 Millisekunden Verzögerung. Im Player beginnen Überschrift, Medienfläche, mobile Wiedergabesteuerung und Lektionsaktionen nach 40, 80, 140 und 200 Millisekunden.

Die umgebende Fläche wird nicht zusätzlich ausgeblendet. Der Modulschlüssel setzt die Präsentation bei einem Modulwechsel zurück. Bei Fokus oder Bedienung wird der betreffende Bereich sofort sichtbar und wiederholt seine Ankunft nicht beim nächsten Kapitel- oder Lektionsklick. Es gibt keine zusätzlichen Animationsbibliotheken oder künstlichen Datenwartezeiten. Auch der dynamische Player verwendet den kleinen bestehenden Ladeindikator.

Die Wischgeste wird mit Pointer Events erkannt. Erst eine horizontale Bewegung über 12 Pixel übernimmt den Pointer; geschlossen wird beim Loslassen nach mindestens 56 Pixeln nach links, wenn der horizontale Weg mindestens das 1,3-Fache des vertikalen Weges beträgt. Horizontale Gesten unterdrücken den nachfolgenden Klick. Vertikale Bewegungen, Pointer-Abbruch und Tastaturbedienung werden getrennt behandelt. `touch-action: pan-y pinch-zoom` gilt für Drawer und seine scrollende Navigation. Die bestehende Radix-Schließanimation und Fokusrückgabe bleiben zuständig.

Die Menüreihenfolge wird nicht neu sortiert. Eine Linie erscheint nur bei einem Wechsel zwischen Ressourcen, Videoserien und Werkzeugen; eigene Seiten und Community gehören zum selben Bereich. Die Linien sind einen Pixel hoch und verwenden die vorhandene Rahmenfarbe mit 60 Prozent Deckkraft. Ihr Abstand und ihre Stärke bleiben unter der Trennung zum Kontobereich.

## Prüfung

| Prüfung | Beobachtung |
| --- | --- |
| Desktop 1440 px, Kurs → März | Inhalte in einer lokalen Messung ab 67 ms vorhanden; vier Lektionszeilen vollständig sichtbar nach 445/476/538/569 ms. Playerfläche nach 445 ms, Aktionen nach 538 ms. |
| Mobil 390 px, Kurs → März | Vier Zeilen vollständig sichtbar nach 443/473/503/533 ms; Breite bleibt 390 px. |
| Mobil 390 px, Inhaltsübersicht → Player | Überschrift/Medienfläche/Wiedergabesteuerung/Aktionen vollständig sichtbar nach 340/371/433/494 ms. |
| Lektions- und Kapitelbedienung | Nächste Lektion und Zurück funktionieren; Auswahl und Aufklappen wiederholen die komplette Präsentation nicht. |
| Listen 320/390/479 px | Coverbreiten mindestens 108 px, bei 390 px rund 120 px und bei 479 px rund 152 px. Weekly- und Advanced-Karten bleiben innerhalb ihrer Liste gleich hoch, ohne horizontalen Überlauf. |
| Lange Lektionstitel, 320 px | Zwei lange September-Titel bleiben in 64 px hohen Zeilen; Titel passen in maximal zwei Zeilen. |
| Tablet 1024 px | Inhaltsübersicht 300 px, Playerbereich 698 px; Lektionszeilen 64 px, kein horizontaler Überlauf. |
| Hover, 1440 px Hell/Dunkel | Schatten blendet auf den Zielwert; Rahmenfarbe und Kartengeometrie bleiben konstant. |
| Wischgesten, mobile Browserbreite | Links über einem Kurslink schließt ohne Navigation; kurze, rechte und vertikale Bewegungen schließen nicht. Anschließender normaler Klick funktioniert. Fokus kehrt zum Menüknopf zurück. |
| Kurzes Display 320 × 568 | Navigation scrollt von 0 auf 258 px und bleibt offen; beide Kontolinks bleiben mit 44 px Höhe sichtbar. |
| Dark Mode, Drawer 390 px | Hintergrund `#242423`, Vorderseite `#141413`; zwei feine Gruppenlinien mit 60 Prozent Deckkraft. |
| Browserprotokoll | Keine JavaScript-Fehler, ein Warnhinweis in der Prüfsitzung. |
| TypeScript und ESLint | Quellen und Vorschau bestehen die Typprüfung; alle sechs geänderten TSX-Dateien bestehen ESLint. |
| Build | `npm run build` erfolgreich; Build-ID `DMEk-CAmoSX-XFg2V9AoK`. |

Die Zeitwerte sind einzelne Messungen einer bereits geladenen lokalen Vorschau mit regelmäßiger DOM-Abfrage, kein allgemeiner Ladezeit-Benchmark. Der Build verwendete ausschließlich Dummy-Zugangsdaten; erwartete Verbindungswarnungen zu der absichtlich unerreichbaren Testdatenbank und Stripe sind kein Nachweis funktionierender Backendzugänge.

Die Wischgeste wurde mit nativen Pointer-Drags im Browser geprüft; ein physisches iPhone wurde in diesem Durchgang nicht bedient. Reduzierte Bewegung wird vom bestehenden CSS-Fallback abgedeckt und im Code geprüft; die Betriebssystemeinstellung wurde nicht verändert. Private Bunny-Wiedergabe zeigt weiterhin den bereits bekannten 403-Status. Dieser Durchgang ändert keine Medienzugriffe und belegt die Darstellung des Players, nicht eine erfolgreiche Videowiedergabe.

## Dateien und Quellen

Hauptdateien sind `app/mentorship/mentorship.css`, `components/middle-sidebar-user.tsx`, `components/video-player.tsx`, `components/modul-detail-client.tsx`, `components/mobile-courses-drawer.tsx`, `components/sidebar-user.tsx` und `app/mentorship/modul/[id]/page.tsx`. Die Vorschau bindet diese Komponenten direkt ein.

Die Umsetzung folgt den dokumentierten Mechanismen für [CSS-Animationsverzögerungen](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-delay), [React-Komponentenschlüssel](https://react.dev/learn/preserving-and-resetting-state), [Pointer Capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) und [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action). Die konkreten Zeit-, Distanz- und Gestaltungswerte sind lokale PAT-Entscheidungen.
