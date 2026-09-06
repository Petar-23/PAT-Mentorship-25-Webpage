# PAT Sans 0.3 und PAT Serif 0.4

Stand: 6. September 2026. Die angepassten Open-Font-Schriften beruhen auf Instrument Sans und Source Serif 4. Ihre Grundformen stammen aus diesen beiden Familien; Proportionen, einzelne Konturen, Serifen und Abstände wurden für die Mentorship bearbeitet. Es sind OFL-Ableitungen, keine vollständig neu gezeichneten oder exklusiven Schriftfamilien. Keine Anthropic-Fontdatei ist eine Eingabe der Build- oder Prüfskripte.

## Gestaltung

PAT Sans verwendet Instrument Sans mit eigener Gewichtung und veränderten Proportionen. Großbuchstaben erreichen 728, die x-Höhe 534 und Oberlängen 750 von 1.000 Einheiten. Die Ausgangsgewichte 455 / 555 / 650 / 700 werden als 400 / 500 / 600 / 700 ausgeliefert. Die sechs Sans-Dateien bleiben gegenüber der zuletzt geprüften Version 0.3 bytegenau unverändert.

PAT Serif verwendet Source Serif 4 bei optischer Ausgangsgröße 28 und kräftigeren Ausgangsgewichten 450 / 555 / 675 / 755 für die ausgegebenen Schnitte 400 / 500 / 600 / 700. Großbuchstaben erreichen weiterhin 748, die x-Höhe 518 und Oberlängen 768 Einheiten. Die Breiten sind nach Buchstaben abgestimmt, einschließlich deutscher Varianten. Diese Einstellungen verstärken die kräftigen Teile der Stämme und Rundungen bei erhaltenen Höhen.

Der aufrechte Serif-Entwurf enthält folgende zusätzliche Konturarbeit:

- W und w erhalten eine Mittelspitze ohne den separaten horizontalen Serif-Ansatz der Ausgangsschrift.
- J erhält einen breiteren Bogen nahe der Grundlinie; Q einen flacheren Schweif und R ein diagonales Bein.
- r erhält einen keilförmigen Abschluss, t einen geschwungenen oberen Übergang. Die Enden von f, j, y und a sind überarbeitet.
- ß erhält den kurzen linken Ansatz; ẞ eine neu aufgebaute Form mit geradem oberen Abschluss.
- Bei I, i und l werden die Serifen verkürzt, ohne die Stämme pauschal schmaler zu skalieren. Der rechte Abschluss von r und die Laufweiten von J und j sind separat abgestimmt. Die entsprechenden Anker werden mitgeführt.

Je Familie gibt es vier aufrechte Schnitte sowie echtes Regular Italic und Bold Italic. Kursivformen stammen aus den kursiven Ausgangsschriften. Sie übernehmen die Gewichts- und Proportionseinstellungen, aber nicht die für aufrechte Buchstaben gezeichneten Einzelkonturen. Die häufigen f-Ligaturen werden aus den überarbeiteten aufrechten Buchstaben und deren Positionierung neu zusammengesetzt.

## Abstände und Prüfung

Klassenkerning berücksichtigt die geänderten horizontalen Proportionen. Zusätzliche Paarregeln behandeln unter anderem We und Wo, V-, T-, F- und Y-Verbindungen sowie r vor runden Kleinbuchstaben. Umlaute erhalten bei Bedarf zusätzlichen Platz. Die Prüfung öffnet ausschließlich Paare, deren Konturen sich ansonsten überschneiden; sie ersetzt keine optische Beurteilung. PAT-Serif-Titel verwenden normales Tracking, damit CSS die abgestimmten Abstände nicht erneut pauschal zusammendrückt.

Alle 60 Groß- und Kleinbuchstaben einschließlich Ä, Ö, Ü, ä, ö, ü, ß und ẞ wurden in einer vergrößerten Browserprobe einzeln betrachtet. Die Abstandsprobe enthält alle 3.600 Kombinationen dieses Zeichensatzes sowie einen direkten Vergleich typischer und anspruchsvoller Paare. Das sichtbare Wortbild wurde zusätzlich an Kursbegriffen, deutschen Wörtern, langen Absätzen und den tatsächlichen Mentorship-Komponenten geprüft.

Der Geometrietest erfasst jede der 3.600 Kombinationen in allen sechs Serif-Schnitten, jeweils mit und ohne Standardligaturen: insgesamt 43.200 Shaping-Prüfungen. Im finalen Lauf wurden keine negativen Konturabstände gefunden. Das Verfahren nähert quadratische Kurven durch 24 Segmente an und prüft Scanlinien im Abstand von zwei Font-Einheiten. Es belegt Kollisionsfreiheit innerhalb dieser Auflösung, keine perfekte optische Gleichheit, vollständige Unicode-Prüfung oder Bildschirmlesbarkeit bei jeder Größe.

Alle zwölf WOFF2-Dateien bestehen außerdem das erneute Einlesen und den Vergleich der HarfBuzz-Textformung vor und nach der WOFF2-Kompression. Pflichtzeichen umfassen Deutsch, Ziffern, Währung, Satzzeichen und häufige mathematische Symbole. Geprüft sind identische Textformung für zusammengesetzte und zerlegte Umlaute und gleiche Ziffernvorschübe bei aktiviertem tnum. PAT Sans ergänzt die im Ausgangsfont fehlenden Zeichen ±, ² und ³ aus Kompositionen der offen lizenzierten Formen.

Die Dateien besitzen eigene Familien-, Schnitt- und PostScript-Namen, vollständige eingebettete OFL-Lizenzen und die ursprünglichen Copyright-Hinweise. Alte Hinting-Programme und nicht mehr passende Konturpunkt-Verweise werden entfernt. Die Browserprüfung erfolgte auf macOS; Windows-Hinting und andere Browser sind nicht vollständig visuell geprüft. Der aktuelle UI- und Build-Prüfstand steht in [MENTORSHIP_PR_VERIFICATION_2026-09-06.md](MENTORSHIP_PR_VERIFICATION_2026-09-06.md).

## Lizenz und Herkunft

Die mitgelieferten Lizenzen erlauben Nutzung und Weiterbearbeitung unter SIL OFL 1.1. Die abgeleiteten Dateien bleiben ebenfalls unter OFL. Es fällt keine Webfont-Lizenzgebühr an. Die Lizenz betrifft die Fonts, nicht die Website oder Kursinhalte.

Quellen: Google Fonts, Commit 5e35378e6bda803962ee6fd257e444a7d459660d. Die vier Eingabefonts, zwei Lizenzen, Downloadadressen und SHA-256-Prüfsummen stehen in tools/mentorship-fonts/source-manifest.json. Das Buildskript prüft die Eingabefonts vor jeder Bearbeitung.

- [Instrument Sans und OFL](https://github.com/google/fonts/tree/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/instrumentsans)
- [Source Serif 4 und OFL](https://github.com/google/fonts/tree/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/sourceserif4)
- [OFL: Änderungen und Weitergabe](https://openfontlicense.org/ofl-faq/)

## Neu bauen und verwenden

`tools/mentorship-fonts/build_fonts.py SOURCE_ROOT` benötigt Python, fontTools mit WOFF2/Brotli-Unterstützung und uharfbuzz. SOURCE_ROOT enthält das Quellenmanifest und die darin genannten Dateien unter source-fonts/ und licenses/. Die drei Python-Dateien bleiben nebeneinander. Das Skript schreibt fonts/, licenses/ und font-validation.json neben sich; es lädt nichts aus dem Netz und verändert keine Anwendungsdateien. Der [Prüfaufruf](../tools/mentorship-fonts/README.md) dokumentiert beide Kerning-Durchgänge.

Die geprüften Anwendungsdateien liegen unter app/mentorship/fonts/. Das Next.js-Modul app/mentorship/fonts.ts lädt die jeweils benötigten Schnitte lokal. Die Variablen und das normale Serif-Tracking gelten in der Mentorship-Shell einschließlich des Menüs. Der normale Next.js-Build erzeugt die Fontdateien nicht erneut.
