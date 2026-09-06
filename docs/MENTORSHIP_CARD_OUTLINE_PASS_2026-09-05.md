# Mentorship: Modulkarten und Inhaltsübersicht

Petars Screenshots zeigten zwei gestalterische Schwächen: Die Modulbilder wirkten von Text und Fortschritt getrennt, und in der mittleren Seitenleiste wechselten die linken Ausrichtungen und vertikalen Abstände. Dieser zusätzliche Design-Pass wurde lokal durch Codex umgesetzt und geprüft; er folgt auf die drei dokumentierten Fable-Gesprächsrunden.

## Überarbeitung

- Ein gemeinsamer, dezenter Rahmen verbindet Cover, Text und Fortschritt der Modulkarte. Weiß in Hell und ein leicht abgesetztes Dunkelgrau in Dunkel machen die Fläche erkennbar. Innenabstände und Titelhierarchie sind vereinheitlicht, die Fortschrittszeilen bleiben innerhalb einer Kartenreihe ausgerichtet.
- Der Kurs-Rückweg steht über dem vollbreiten Modultitel. Titel, Fortschritt und Kapitel verwenden eine gemeinsame linke Achse. Kapitelname, Anzahl und Aufklapppfeil sind klar getrennt; die breitere Desktop-Seitenleiste reduziert unnötige Titelumbrüche.
- Lektionen verwenden einen festen Bereich für Nummer oder Statussymbol. Titel, Dauer, PDF- und Abschlussstatus erhalten konsistente Zeilenhöhen und Abstände. Eine aktive PDF-Lektion trägt ein Dokumentsymbol. Lange deutsche Titel dürfen umbrechen.
- Im Tastaturtest fiel auf, dass der Scroll-Viewport seitliche Fokusrahmen abschnitt. Innenabstand innerhalb dieses Viewports erhält die vollständigen Rahmen. Der Kurs-Rückweg, das Aufklappen der Kapitel und der Lektionswechsel bleiben per Tastatur erreichbar.
- Die Ladeansichten übernehmen die neuen Kartenflächen und die Geometrie der Inhaltsübersicht. Für das dynamische Laden und die anfängliche Desktop-Platzhalteransicht wird derselbe Seitenleisten-Skeleton verwendet.

## Tatsächlich geprüft

- 20 Ansichten für Karten und Inhaltsübersicht: 1440, 1024, 768, 390 und 320 Pixel, jeweils Hell und Dunkel. Kein horizontaler Überlauf; ausgewählte Ansichten wurden visuell beurteilt.
- 86 gezielte Browserprüfungen für Textumbrüche, Tastaturfokus ohne Abschneiden, Kapitelsteuerung, fortlaufende Nummerierung, Kurs-Rückweg und variable Karteninhalte. Lange Texte wurden ausschließlich in der isolierten Testansicht eingesetzt.
- Die bestehenden 63 Browserprüfungen wurden auf dem abschließenden Stand erneut bestanden: Suche, Theme, Navigation, PDF-Link, Fortschritt einschließlich fehlgeschlagenem Speichern und erneutem Versuch sowie Wechsel zur nächsten Lektion.
- Sechs zusätzliche Ansichten mit den Produktionsschriften Geist/Georgia: Karten und Inhaltsübersicht bei 1440, 390 und 320 Pixeln. Kein horizontaler oder zusätzlicher Dokument-Überlauf. Die private Schriftvorschau bleibt getrennt.
- Ladeansichten bei 1440 und 390 Pixeln mit angehaltenem lokalen Komponenten-Request aufgenommen und visuell geprüft.
- TypeScript, ESLint der geänderten TSX-Dateien und `git diff --check` bestanden. Webpack-Produktionsbuild erfolgreich, Build-ID `g7hRHlytDq9q3lMl9D1Z1`.

Die Browserprüfungen verwenden echte UI-Komponenten mit Beispieldaten auf Port 3017 und blockieren andere Origins. Der Build verwendet Platzhalter für Datenbank und Stripe; erwartete Meldungen zu nicht erreichbaren Diensten sind keine Prüfung dieser Integrationen. Echte Anmeldung, Mitgliederdaten und private Videowiedergabe bleiben ungetestet. Dieser Design-Pass umfasst kein Deployment.

Prüfskripte, Bilder und Logs liegen unter `/private/tmp/pat-mentorship-card-outline-pass`. Bericht, ausgewählte Bilder, Prüfergebnisse und ein vollständiger Patch des lokalen Arbeitsstands werden zusätzlich im Artefaktordner dieser Aufgabe gesichert.
