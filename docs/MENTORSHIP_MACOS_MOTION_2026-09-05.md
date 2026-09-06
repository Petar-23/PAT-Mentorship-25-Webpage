# macOS-Design und Bewegung in der Mentorship

Kontolinks, Kapitelköpfe und einzelne Symbolbuttons wechselten ihre Hintergründe bisher sofort, während andere Elemente bereits Übergänge hatten. Die Oberfläche verwendet jetzt gemeinsame Fades, weich öffnende Kapitel und ein Menü, dessen Inhalt beim Schließen bis zum Ende sichtbar bleibt.

## Abgleich mit aktuellen Apple-Quellen

Geprüft am 5. September 2026: Apples [WWDC26 Design Guide](https://developer.apple.com/wwdc26/guides/design/), die am 8. Juni 2026 überarbeiteten [Design Principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) und [Materials](https://developer.apple.com/design/human-interface-guidelines/materials). Die beiden ersten HIG-Seiten wurden zusätzlich vollständig im Browser gelesen. Apples [AppKit-Designvortrag](https://developer.apple.com/videos/play/wwdc2025/310/) erläutert die bestehenden Grundlagen der neuen macOS-Formen und Materialebenen.

Apples aktuelle Prinzipien betonen vertraute, konsistente Rückmeldungen, kontrollierbare Abläufe, Anpassung an Eingaben und sorgfältige Details. Für PAT bedeutet das ein ruhiges Lernwerkzeug: Inhalt und Position bleiben verständlich, während Zustände sanft wechseln. Die Mac-spezifischen Hinweise zu großzügigen Arbeitsflächen und Tastaturbedienung passen zur bestehenden parallelen Kurs-, Kapitel- und Playeransicht. Die gewählten Zeitwerte und Radien sind PAT-Entscheidungen, keine von Apple vorgeschriebenen Web-CSS-Werte.

## Umsetzung

- Gemeinsame Farbübergänge für Navigation, Kontolinks, Kapitel, Episoden, Karten, Suche, Buttons und Unterlagen. Unterstreichungen werden über ihre Farbe eingeblendet, statt plötzlich aufzutauchen. Hover-Eintritt und -Austritt verwenden dieselbe Kurve.
- Rückmeldung in 180 ms mit `cubic-bezier(.2,0,0,1)`. Öffnen in 260 ms mit `cubic-bezier(.16,1,.3,1)`, Schließen in 180 ms. Es gibt keine künstliche Wartezeit vor einer Aktion.
- Kapitel nutzen die vorhandene Radix-Accordion-Bibliothek. Neben animierter Höhe und Deckkraft funktionieren Pfeiltasten, Home und Enter. Geschlossene Kapitel verlassen die Tab-Reihenfolge. Die gleich hohen Episoden und vollständigen Fokusrahmen bleiben erhalten.
- Das Menü blendet über eine kurze horizontale Bewegung ein und in dieselbe Richtung aus. Seine Inhalte bleiben während der Schließanimation erhalten. Escape schließt es und gibt den Fokus an den Auslöser zurück.
- Der Theme-Wechsel blendet Farben und Sonn-/Mondsymbol über. Toolbar-Symbole sind kreisförmig, große Aktionsbuttons und Suche kapselförmig. Navigation, Kapitel und Karten teilen einen Radius von 12 px; größere Flächen bleiben bei 16 px.
- Eine dezente durchscheinende Oberfläche beschränkt sich auf das eingeblendete Navigationsmenü. Hintergrundunschärfe ist nicht animiert. Bei erhöhter Kontrasteinstellung oder reduzierter Transparenz ist das Menü deckend. Diese CSS-Oberfläche ist eine Web-Adaption der Materialhierarchie, keine native Liquid-Glass-Implementierung.
- Reduzierte Bewegung entfernt Verschiebungen, Drehungsübergänge und Kapitel-Höhenanimationen. Kurze Farb- und Deckkraftfades von 120 ms bleiben erhalten. Tastatur-Fokusrahmen erscheinen unmittelbar.

## Verifikation

46 Prüfungen untersuchen unter anderem 37 tatsächlich über Zwischenbilder gemessene Übergänge. Hover-Fades lieferten mehrere verschiedene Zwischenfarben, Kapitel mehrere Zwischenhöhen. Hell, Dunkel, Desktop, Smartphone, reduzierte Bewegung und erhöhter Kontrast wurden geprüft. Weitere 16 Prüfungen bestätigen unverdeckte Fokusrahmen an der ersten und letzten Episode bei 1440, 1024, 390 und 320 px in beiden Darstellungen. Vier Schließprüfungen bestätigen erhaltene Menüinhalte während des Fades und anschließende Fokusrückgabe.

Die 59 bestehenden Prüfungen der echten Kursdaten, aller 94 Lektionen, 35 PDF-Zuordnungen, Modulsuche und lokalen Fortschrittsaktionen bestanden nach der Kapitelumstellung erneut. TypeScript, gezieltes ESLint und der lokale Produktionsbuild bestanden. Der Build verwendete Testplatzhalter für Datenbank, Clerk und Stripe. Externe Playerzugriffe wurden in den automatischen UI-Prüfungen blockiert.

Die echte lokale Bunny-Einbettung bleibt separat mit 403 blockiert; dieser Design-Durchgang bestätigt keine Videowiedergabe. Der Stand bleibt lokal und wurde nicht committed, gepusht oder veröffentlicht. Medienstatus und Bildserie sind im [Bericht zur Datenanbindung](MENTORSHIP_LIVE_PREVIEW_2026-09-05.md) dokumentiert.
