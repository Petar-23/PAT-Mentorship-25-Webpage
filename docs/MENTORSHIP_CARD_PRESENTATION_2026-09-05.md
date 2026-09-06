# Kartenpräsentation und kompakte Lektionsliste

Petars Feedback zu Kartenschatten, Konto-Icons, Seitenankunft, Ladeanzeige und überhohen Lektionszeilen ist in der isolierten Vorschau umgesetzt. Der ergänzende Hinweis zur fehlenden Ebenentrennung im dunklen mobilen Menü ist ebenfalls berücksichtigt.

- Der Hover-Schatten blendet über 280 ms ein und aus. Rahmenfarbe und Kartenposition bleiben konstant.
- Mitgliedschaft und Mein Konto tragen passende Phosphor-Symbole auf der linken Textachse.
- Kurskarten erscheinen über 280 ms mit jeweils 40 ms Versatz und 8 px Bewegung. Der Versatz ist auf 200 ms begrenzt. Suche und Ansichtswechsel starten die Präsentation nicht erneut. Tastaturfokus macht eine Karte sofort sichtbar.
- Screen-Skeletons wurden durch einen kleinen Ladeindikator mit deutschem Status ersetzt. Er blendet nach 140 ms ein, wenn der Inhalt noch fehlt. Die Anzeige endet mit dem tatsächlichen Ladezustand; es gibt keine künstliche Wartezeit.
- Lektionszeilen sind bei normaler Basisschrift 64 px hoch. Maximal zwei Titelzeilen und rechts stehende, einzeilige Laufzeiten bleiben eng verbunden. Ohne Laufzeit steht die volle Titelbreite zur Verfügung. Vollständige Titel und Abschlussstatus bleiben zugänglich.
- Der mobile Dark-Mode-Hintergrund ist #242423, die Vorderseite #141413. Lichtkante und Schatten machen die räumliche Trennung sichtbar.

## Verifikation

TypeScript für Anwendung und Vorschau sowie gezieltes ESLint erfolgreich. Der abschließende Produktionsbuild bestand einschließlich seiner TypeScript-Prüfung; Build-ID `AW_Rr7a1cBqKKh04G22Sa`. Die Prüfung verwendete Dummy-Zugangsdaten und eine absichtlich unerreichbare lokale Testdatenbank. Erwartete Datenbank-/Stripe-Warnungen sind keine Backend-Verifikation.

Im Browser wurden 320, 390, 1024 und 1440 Pixel sowie helle und dunkle Darstellung geprüft. Die Hover-Messung zeigt in beiden Themes eine konstante Rahmenfarbe und identische Geometrie bei zunehmender Schattendeckkraft. Im mobilen Menü wurden #242423 und #141413 als getrennte Flächen bestätigt; der sichtbare Seitenversatz beträgt bei 390 px Breite 322 px, auf dem Tablet 336 px.

Die geprüften Weekly-, Advanced- und Core-Content-Lektionszeilen sind durchgehend 64 px hoch, auch bei langen Titeln, fehlender Laufzeit und Laufzeiten über einer Stunde. Bei 320 px bleibt die Dokumentbreite 320 px. Native Tastatureingabe zum Leeren der Suche stellt alle vier geprüften Module wieder her; Suche und Listenansicht verwenden danach keine Ankunftsanimation.

Beim echten Kurs-Kaltstart erschien der rotierende Ladeindikator und wurde durch vier Karten ersetzt. Die Kopfzeile blieb 56 px hoch. Im lokalen Wechsel Übersicht → Weekly Reviews wurden die fünf Karten mit 0/40/80/120/160 ms Verzögerung präsentiert; alle waren im Sample nach 563 ms vollständig sichtbar. Das ist ein einzelner lokaler Lauf, keine allgemeine Performance-Zusage.

Keine erfassten Browser-Laufzeitfehler; sieben Entwicklungshinweise zu Bildern. Der vorhandene 403-Zustand privater Videowiedergabe wurde nicht verändert. Ein physischer iPhone-/Safari-Test sowie eine Prüfung mit aktivierter Betriebssystem-Präferenz für reduzierte Bewegung sind nicht enthalten; die entsprechenden CSS-Regeln wurden im Code geprüft.

## Quellen und Umfang

[Next.js loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading) beschreibt die tatsächlich ersetzbare Ladeansicht. [MDN animation-delay](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-delay) dokumentiert den CSS-Versatz. Die konkrete Gestaltung folgt Petars Feedback und seinem Screenshot. Es wurden keine neuen Abhängigkeiten ergänzt und keine Veröffentlichung oder Bunny-Änderung vorgenommen.
