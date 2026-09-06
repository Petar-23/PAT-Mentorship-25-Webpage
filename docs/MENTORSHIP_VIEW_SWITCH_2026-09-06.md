# Ansichtswechsel und kompakter Drawer

Stand: 6. September 2026. Lokaler Reviewstand der privaten Mentorship-Vorschau.

## Ergebnis

Der Wechsel zwischen Kacheln und Liste erhält einen abgestimmten Übergang: Die Auswahlfläche gleitet zum anderen Symbol, der Inhalt blendet kurz aus und erscheint in seiner neuen Anordnung wieder. Suchfeld und Schalter bleiben dabei an derselben Position. Das mobile Menü verwendet engere Abstände; alle aktuellen Ziele einschließlich Indikatoren passen bei 320 × 667 und 390 × 667 Pixeln ohne Scrollen.

## Umsetzung

- Die Auswahlfläche bewegt sich über 280 Millisekunden um 44 Pixel. Beide Buttons behalten ihre Beschriftungen, ihren Fokus und `aria-pressed`.
- Die Ergebnisfläche blendet über 100 Millisekunden aus und bewegt sich dabei 4 Pixel nach oben. Der Layoutwechsel erfolgt bei null Deckkraft; anschließend blendet die neue Anordnung über 200 Millisekunden mit 4 Pixeln Bewegung ein.
- Browseranimationen verwenden die vorhandene Ergebnisfläche. Ein neuer Klick übernimmt deren aktuelle Deckkraft und Position, bricht die bisherige Animation ab und setzt das neue Ziel. Die bereits gewählte Ansicht ist ein No-op. Der Ergebniscontainer bleibt auch bei leerer Suche erhalten; Suchbegriff, Kartenlinks, Fortschritt und Modulreihenfolge bleiben bestehen.
- `flushSync` stellt den DOM-Wechsel zwischen den beiden Browseranimationen sicher. Der Ansatz folgt den dokumentierten APIs für [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate), [Animation.finished](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished) und [React flushSync](https://react.dev/reference/react-dom/flushSync). Es kommt keine weitere Bibliothek hinzu.
- Der Scrollbereich verwendet [scrollbar-gutter: stable](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter). Damit verschiebt eine neu benötigte klassische Scrollleiste die Bedienelemente nicht seitlich.
- Im mobilen Menü messen Zeilen mindestens 44 Pixel bei unverändert 16 Pixel Schrift. Der Abstand zwischen Zeilen beträgt 2 Pixel, die Kopfzeile 56 Pixel. Gruppen und Kontobereich erhalten kleinere Zwischenräume. Zweizeilige Namen dürfen die Zeilenhöhe erweitern. Feine Gruppentrenner, Wischgeste und Kontoziele bleiben erhalten.
- Bei reduzierter Bewegung wird der Inhaltswechsel unmittelbar ausgeführt. Die bestehende CSS-Regel entfernt auch die räumliche Bewegung der Auswahlfläche. Beim Verlassen der Komponente wird eine laufende Browseranimation abgebrochen.

## Prüfung

| Fall | Ergebnis |
| --- | --- |
| Desktop und mobiles Hell/Dunkel | Kacheln, Liste, Auswahlfläche und kompaktes Menü visuell geprüft. Keine horizontale Seitenüberbreite. |
| Vollständiger Desktop-Übergang | Ausblenden der alten Ansicht und Einblenden der neuen Ansicht im Browser aufgezeichnet; Endzustand Deckkraft 1 ohne Transformation. |
| Mobile dunkle Darstellung, 390 × 667 | Alter Kartenaufbau blendet aus; Liste erscheint und endet vollständig sichtbar. Alle fünf Listenzeilen bleiben 134 Pixel hoch. |
| Fünf Wechsel im Abstand von etwa 65 Millisekunden | Zwischenstände werden übernommen; das letzte Ziel ist anschließend vollständig sichtbar und entspricht der aktiven Auswahl. |
| Tastatur und aktive Auswahl | Enter schaltet korrekt um und hält den Fokus am gewählten Button. Enter auf der bereits aktiven Ansicht belässt den Inhalt vollständig sichtbar ohne Transformation. |
| Suche und leere Ergebnisse | „März“ behält denselben Modul-Link und Fortschritt in beiden Ansichten. Eine erfolglose Suche bleibt bedienbar; „Alle Module anzeigen“ stellt alle fünf Module wieder her. |
| Keine wiederholte Kartenpräsentation | Nach dem Ansichtswechsel ist `data-present=false`; einzelne Karten haben keine erneute Eingangsanimation. |
| Klassische Scrollleiste bei 1440 × 1024 | Vorher verschob sich die Toolbar um 15 Pixel. Nach der Korrektur bleiben Breite, linke Kante und Oberkante über den gesamten Übergang konstant. |
| Drawer, 390 × 667 | Navigation: 486 Pixel sichtbare und gesamte Höhe, Scrollposition 0. Indikatoren endet bei rund 528 Pixeln, vor der unteren Navigationskante bei 546 Pixeln. Der Link öffnet das richtige Vorschauziel und schließt das Menü. |
| Drawer, 320 × 667 | Ebenfalls ohne Scrollen; der lange Core-Content-Titel bricht um. Indikatoren endet bei rund 540 Pixeln vor der Navigationskante bei 546 Pixeln. |
| Drawer, 320 × 568 | Der Inhaltsbereich scrollt von 0 auf 106 Pixel. Beide Kontolinks bleiben im festen Fuß sichtbar. |

Typprüfung, gezieltes ESLint der geänderten Komponente, der endgültige Build und die Typprüfung der Vorschau sind erfolgreich. Der Build verwendet lokale Testwerte; erwartete Meldungen zu nicht erreichbarer Datenbank und Stripe liefern keine Aussage zur Produktivverbindung. Die Browserprüfung erfasst keine JavaScript-Fehler und vier Next.js-Bildwarnungen zu LCP-Ladepriorität und Logo-Abmessungen.

Die Messungen stammen aus dem lokalen In-App-Browser und sind keine Geschwindigkeitsbenchmarks. Ein physischer iPhone-Test und ein Lauf mit veränderter Betriebssystempräferenz für reduzierte Bewegung sind nicht enthalten; der entsprechende JavaScript- und CSS-Pfad wurde im Code geprüft. Videowiedergabe und externe Kontoaktionen gehören nicht zu dieser Prüfung.
