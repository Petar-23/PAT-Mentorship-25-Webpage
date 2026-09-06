# Mobile Navigation und weichere Seitenwechsel

Petars Claude-App-Referenz zeigt eine Navigation hinter der seitlich verschobenen Seite. Dieser Aufbau ist in der isolierten PAT-Vorschau umgesetzt. Gleichzeitig wurden die Gewichte der Überschriften von 700 auf 600 reduziert und die Übergänge von Übersicht zu Kursliste und Modul vereinheitlicht. Warme Farben und die vorhandenen Schriftrollen bleiben erhalten.

## Verhalten

- Die vollständige mobile Seite verschiebt sich horizontal, ohne ihre Breite oder Schriftgröße zu ändern. Hinter ihr erscheint die deckende Navigation. Der sichtbare Seitenrand schließt das Menü bei Berührung.
- Öffnen: 440 ms, Schließen: 320 ms. Die Seitenecken runden sich auf 32 px. Die Navigationsbreite ist auf 336 px begrenzt; auf kleinen Displays bleiben 68 px der Vorderseite sichtbar.
- Radix Dialog übernimmt Modalität, Escape, Fokusbegrenzung und Fokusrückgabe. Der Portal-Container liegt im gemeinsamen App-Rahmen. Der Menüinhalt bleibt bis zum Ende der Schließbewegung montiert. Interne Navigation schließt über `onNavigate`; die native Link-Bedienung bleibt erhalten.
- Next.js-Links bereiten Mentorship-Ziele bei Hover, Fokus und Touch vor. `useLinkStatus` steuert einen dezenten Hinweis mit 140 ms Verzögerung. Schnelle Seitenwechsel erzeugen damit keinen unnötigen Ladeblitz. Es gibt keine künstliche Mindestwartezeit.
- Die Seitenankunft blendet über 220 ms von 65 auf 100 Prozent Deckkraft ein. Die bisherige zusätzliche Animation einzelner Header- und Lernkarten entfällt.
- Ladeansichten verwenden die gemeinsamen Workspace-Abstände und passende Header-, Such-, Karten- und Lektionsgeometrien. Auf mobilen Modulrouten entscheidet derselbe `view`-/`video`-Kontext wie im fertigen Inhalt zwischen Übersicht und Player; ein ausdrückliches `view=content` hat Vorrang.
- Überschriften verwenden Gewicht 600. Die vorhandene CSS-Kantenglättung bleibt aktiv. Schrift-Rasterung hängt weiterhin vom jeweiligen Browser und Betriebssystem ab. Bei reduzierter Bewegung entfallen räumliche Übergänge und Seitenankunft.

## Prüfung

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript, isolierte Anwendung | Erfolgreich |
| TypeScript, Vorschau einschließlich Ladeansichten | Erfolgreich |
| ESLint für die geänderten TSX-Dateien | Erfolgreich |
| Produktionsbuild der isolierten Anwendung | Erfolgreich, Build-ID `e7P1ShTzKW3elrRzL6dww` |
| Mobil, 320 und 390 px | Kein horizontaler Dokumentüberlauf; lange Kursnamen passen; Menü und Vorderseite behalten ihre Geometrie |
| Fokus im Menü | Shift+Tab vom Schließen-Button landet beim letzten Menülink; Tab vom letzten Link kehrt zum Schließen-Button zurück |
| Menü schließen | Escape, Tippen auf den sichtbaren Seitenrand und interne Auswahl geprüft; Fokus kehrt zum Menüschalter zurück |
| Tablet, 1024 px, dunkel | Navigation 336 px breit; vollständige Vorderseite wird um 336 px verschoben; kein Dokumentüberlauf |
| Wechsel zu 1280 px | Mobiles Menü schließt; Vorderseite bei x=0; Desktop-Seitenleiste 232 px breit |
| Desktop ein-/ausblenden | Eingeklappte Seitenleiste 0 px breit und `inert`; Fokus bleibt am Schalter |
| Mobile Modulübersicht | Öffnet ohne eingeblendeten Player; vier geprüfte Lektionszeilen jeweils 85,39 px hoch, auch ohne Laufzeit |
| Kaltstart einer Kursroute bei 390 px | Richtiger Status „Module werden geladen“; Kopfzeile 56 px und Logo x=64 px vor und nach dem Laden identisch; Toolbar im geprüften Fall nur 1,59 px versetzt |
| Übersicht → Weekly Reviews | Lokaler Messlauf mit bereits geladenem Katalog: Routenwechsel beim Sample nach 101 ms; alte Seite bis dahin sichtbar; neue Deckkraft mindestens 0,65; Kopfzeile durchgehend 56 px, Dokumentbreite 390 px |
| Browserkonsole | Keine erfassten Laufzeitfehler; sechs Next.js-Hinweise zu Bildabmessungen beziehungsweise bevorzugtem Laden von Logo und erstem Cover |

Die UI-Prüfung erfolgte im In-App-Browser über die private Telefon-Vorschau. Die Zeitmessung ist ein einzelner lokaler Lauf mit rund 30–40 ms Sample-Abstand und keine allgemeine Netzwerk- oder Produktionsbenchmark. Ein Test auf dem physischen iPhone/Safari und eine Prüfung mit aktivierter Betriebssystem-Präferenz für reduzierte Bewegung sind nicht enthalten. Die entsprechende CSS-Regel wurde im Code geprüft.

Der Build verwendete Dummy-Zugangsdaten und eine absichtlich unerreichbare lokale Testdatenbank. Erwartete Datenbank-/Stripe-Warnungen beendeten den Build nicht mit einem Fehler; daraus folgt keine Verifikation von Backend, Kontofunktionen oder Videowiedergabe. Dieser Durchgang betrifft die isolierte Vorschau und enthält keine Veröffentlichung oder Änderung an Bunny.

## Quellen

- [Next.js: useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status) für den Linkstatus im echten Navigationsablauf; die verwendete API ist in der installierten Version 16.1.4 enthalten.
- [Next.js: Link und onNavigate](https://nextjs.org/docs/app/api-reference/components/link) für native Navigation, Prefetch und die Trennung zwischen Navigation und anderen Link-Aktionen.
- [Next.js: loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading) für unterbrechbare Übergänge und gemeinsame Layouts.
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) für den eigenen Portal-Container, Fokusführung und Escape.

Die konkrete räumliche Anordnung folgt Petars beigefügter Claude-App-Referenz. Zeiten, Abstände und CSS-Werte sind Entscheidungen für diese PAT-Weboberfläche.
