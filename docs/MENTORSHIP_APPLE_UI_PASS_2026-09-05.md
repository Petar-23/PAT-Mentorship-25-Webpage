# Apple UI Pass · 5. September 2026

Der lokale Vergleich ersetzt die bisherige Anthropic-geprägte Bedienoberfläche durch eine kompaktere Oberfläche mit Systemschrift, abgesetzter Navigation und klarer Trennung zwischen Navigation und Inhalt. PAT-Logo, Coverwelt, Kursdaten und die kräftigen Phosphor-Icons bilden weiterhin die Identität.

## Umsetzung und Quellen

- **Systemschrift und Hierarchie:** native Schrift über `-apple-system` mit Fallbacks; Haupttitel 28/26 px und Gewicht 700. Die vorherige Serif-Überschrift maß auf demselben Desktop 42 px. [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography).
- **Seitenleiste:** 232 px breite Navigation mit eigenem Rahmen, 12 px Abstand zur Inhaltsfläche und 16 px Radius. Schalter zum Ein-/Ausblenden links im Header, Zustand in der aktuellen Shell-Sitzung. Verborgene Navigation ist inert und per `aria-hidden` aus dem Accessibility-Baum entfernt. [Apple HIG: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars).
- **Werkzeugleisten:** 56 px hoher Header; Navigation links, Darstellung und Profil rechts. Kurssuche und reale Kachel-/Listenumschaltung in einer gemeinsamen Zeile. Beide Ansichten nutzen dieselben Module, Fortschritte und Links. Alle neuen Schalter haben 44 × 44 px Trefferfläche und zugängliche Namen. [Apple HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars).
- **Flächen und Farbe:** neutrale Fensterfläche, solide Inhaltsfläche, blau nur für Funktionen, Auswahl und Fokus. Dezente Transparenz ist auf Navigation begrenzt. Bei reduziertem Transparenzwunsch oder erhöhtem Kontrast wird sie deckend. Inhaltskarten behalten 12 px Radius, der äußere Inhaltsrahmen erhält 18 px. [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [WWDC25: Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/310/).
- **Bewegung:** vorhandene 180/260-ms-Rhythmen bleiben konsistent; das Ein-/Ausblenden der Desktopnavigation verändert zusätzlich den verfügbaren Platz. Die vorhandene Reduced-Motion-Regel schließt Breiten-/Positionsübergänge aus. Diese neue Regel wurde im Code geprüft; der aktuelle Browserdurchgang simulierte keine Betriebssystempräferenz. [Apple HIG: Motion](https://developer.apple.com/design/human-interface-guidelines/motion).

Dies ist eine Umsetzung für eine PAT-Webapp, keine Apple-Zertifizierung oder vollständige native macOS-Oberfläche. Farben, CSS-Pixel, Radien und Zeiten sind konkrete Gestaltungsentscheidungen dieses Vergleichs. Es werden weder San-Francisco-Fontdateien noch SF Symbols kopiert. 32 offizielle Phosphor-Bold-Glyphen kommen aus der bereits vorhandenen Bibliothek 2.1.10.

## Aktuelle Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| Source TypeScript | `npm run typecheck`: Exit 0 |
| Vorschau TypeScript | `npx tsc --noEmit`: Exit 0 |
| ESLint der geänderten TSX-Dateien | Exit 0 |
| Source Produktionsbuild | Exit 0; BUILD_ID `BtVZOBGEoTNxkC52HHpdu` |
| Patch-Whitespace | `git diff --check`: Exit 0 |
| Desktop 1280 px, Hell/Dunkel | Browseransichten visuell geprüft |
| Tablet 1024 px | Zwei Kartenspalten; Menü erreichbar; Lektionsübersicht 300 px; kein horizontaler Überlauf |
| Mobil 390 px | Liste, Drawer, Kurswechsel und Lektionsübersicht geprüft |
| Mobil 320 px | Langer Core-Content-Titel vollständig; Dokumentbreite 320 px |
| Desktopnavigation | Mit Enter geschlossen/geöffnet; geschlossen 0 px Breite, `inert` vorhanden, `aria-hidden=true`; Tab setzt den Fokus außerhalb der Navigation fort |
| Drawer | 8 px Rand, 336 px Breite bei 390 px Viewport, 20 px Radius; 9 Navigationszeilen je 52 px; Escape schließt und setzt Fokus auf den Menüschalter |
| Suche und Ansicht | April in Liste gefunden; 0-Treffer-Zustand und Rücksetzen auf alle fünf Weekly-Module geprüft; Buttons melden Auswahl mit `aria-pressed` |
| Lektionszeilen | Alle vier März-Zeilen 85,390625 px hoch, jeweils 12 px Radius; Kapitelüberschrift Gewicht 700 |
| Kapitel per Tastatur | Ein-/Ausklappen mit Enter; geschlossener Zustand nach Animation ohne sichtbare Lektionszeilen |
| Typografie im Browser | Systemschrift-Stack, Desktop-Haupttitel 28 px/700, mobil 26 px; `-webkit-font-smoothing: antialiased` |
| Textkontrast | 22 Kombinationen aus Hell/Dunkel-Palette; Minimum 4,78:1; alle >= 4,5:1 |

Die Kontrastprüfung betrifft die aufgeführten Text-/Flächen-Paarungen und ist kein vollständiger WCAG-Audit. Der Produktionsbuild verwendete Testkonfiguration und eine absichtlich unerreichbare Datenbank an 127.0.0.1:9. Die protokollierten Datenbank- und Stripe-Verbindungswarnungen belegen keine Prüfung dieser externen Dienste; Kompilierung, Typen und Build selbst sind erfolgreich.

Die Modulkarten beginnen im aktuellen 1280-px-Vergleich bei y=273,2; zuvor rund y=362. Dieser konkrete Platzgewinn ist sichtbar. Eine messbare Verbesserung für echte Mitglieder wurde nicht durch einen Nutzertest untersucht.

## Grenze der lokalen Vorschau

Indikatoren, Community und Konto bleiben in der lokalen Vorschau Zugänge zum echten PAT-Konto. Die Indikatorenseite zeigt eine TradingView-Zugangskarte, keine fingierten Freischaltungen. Der Vorschauhinweis steht nun in der Kopfzeile; sein Tooltip und zugänglicher Name nennen echte Kursinhalte und lokal gespeicherten Fortschritt.

Der bekannte Bunny-403 tritt im lokalen Video-Iframe weiterhin auf und wurde im Tablet-Lektionslayout beobachtet. Dieser UI-Pass ändert keine Bunny-Freigaben und bestätigt keine funktionierende Videowiedergabe. Keine Produktionsdaten, Veröffentlichung, Commits oder Pushes wurden für diesen Vergleich vorgenommen.

## Dateien und Vergleich

Codeänderungen betreffen Shell, Seitenleiste, Modulraster, drei zusätzliche Phosphor-Glyphen, Member-Page-Container, mobilen Lektionscontainer und das gemeinsame CSS. Persönliche Aktionen und Admin-Container behalten ihre bisherige Logik. Der Stand vor diesem Pass und die veränderten Dateien sind im lokalen Reviewpaket gesichert; der Patch enthält ausschließlich die Änderungen dieses Apple-Passes.

Die Screenshots zeigen Desktop Hell/Dunkel, Kacheln und Liste, Suche, ausgeblendete Navigation, mobilen Drawer, Lektionsübersicht, 320-px-Kurstitel und Tablet. Der Vorher-nachher-Vergleich verwendet die direkt vorangehende Phosphor-/Anthropic-Variante als Ausgangspunkt.
