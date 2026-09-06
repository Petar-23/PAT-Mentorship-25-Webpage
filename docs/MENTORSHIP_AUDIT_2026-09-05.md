# Mentorship: Icons, Vereinfachung und Verifikation

Dieser Bericht hält den Stand vor der anschließenden Designberatung fest. Die Weiterentwicklung von Navigation und Dashboard samt erneuter Validierung steht im [Fable-Review](MENTORSHIP_FABLE_REVIEW_2026-09-05.md).

Lokaler Stand auf `codex/mentorship-experience-2`, verglichen mit Commit `5fd95404`. Umfang: die Mentorship-Lernoberfläche und ihre lokalen Prüfwege; ergänzend eine Triage der offenen GitHub-Einträge.

## Icons

25 statische Symbole aus [Tabler Outline v3.46.0](https://github.com/tabler/tabler-icons/tree/v3.46.0/icons/outline) ersetzen die bisherigen Icons in Navigation, Kursübersicht, Lektionen, Darstellungswechsel, Community und Indikatorübersicht. Alle verwenden ein 24×24-Raster mit Strichstärke 1,75 und runden Linienenden. Die Auswahl liegt in `components/mentorship/icons.tsx`; die MIT-Lizenz unter `public/licenses/tabler-icons.txt`.

Benannte SVGs erhalten eine Bildrolle; dekorative Symbole werden für Screenreader ausgeblendet. Der Player zeigt eigene Zehn-Sekunden-Symbole. Es wurde kein weiteres Paket installiert.

## Vereinfachung

- `components/module-grid-user.tsx`: Der bisherige zweite Fortschritts-Ladeweg mit Abbruchverwaltung, Fokus-/Sichtbarkeits-Listenern und JSON-Aufbereitung entfällt. Der einzige produktive Mitgliederaufruf erhält die Fortschritte bereits vom Server. Fehlende Daten bleiben als „Fortschritt nicht verfügbar“ sichtbar.
- `components/mobile-courses-drawer.tsx`: Der zusätzliche dynamische Import der bereits im Mitgliederbereich verwendeten Sidebar samt Ladeplatzhalter entfällt. Die Inhalte erscheinen weiterhin erst bei geöffnetem Menü.
- `components/module-grid-{user,client,admin}.tsx`: Ungenutzte Props für frühere Menüknöpfe entfallen; das Menü sitzt im gemeinsamen Header.
- `components/mentorship/welcome-name.tsx`: Ein Memo-Hook für die einfache Namensauswahl entfällt.
- Die Modulsuche hält die ursprüngliche Zuordnung der Standardbilder bei, ohne für jedes Ergebnis erneut `indexOf` auszuführen.

Die bestehenden 47 Tests prüfen unter anderem Zielvalidierung, Idempotenz, Parallelzugriffe, Veröffentlichungsvoraussetzungen und Uploads. Es wurde keiner davon als vermeintlich unnötig gelöscht.

## Performance

Die statischen Indikator-Anleitungen werden mit dem bestehenden Markdown-Renderer und unverändertem Sanitizing auf dem Server erzeugt und als React-Inhalt an die interaktive Liste übergeben. Das native Aufklappen bleibt erhalten. Der Renderer ist im finalen Client-Manifest der Indikatorseite nicht mehr enthalten. Dieses Muster entspricht der [Next.js-Dokumentation zu Server-Inhalten in Client-Komponenten](https://nextjs.org/docs/app/getting-started/server-and-client-components#interleaving-server-and-client-components).

Die unabhängigen Abfragen für Indikatorpakete, Freischaltungen und TradingView-Zuordnung starten parallel. Dafür wurde keine Datenbanklatenz gemessen.

Der Vergleich verwendet zwei Webpack-Produktions-Builds mit denselben installierten Abhängigkeiten und denselben Auth-/Datenbank-/Stripe-Platzhaltern. Der Ausgangscommit wurde dafür separat neu gebaut. Gezählt werden alle im Client-Referenzmanifest einer Route genannten JS-Dateien, pro Route jeweils einmal, einschließlich URL-kodierter dynamischer Pfade. Das sind Build-Dateigrößen, keine gemessenen Netzwerktransfers, Nutzerladezeiten oder Core Web Vitals. Gemeinsame Dateien werden beim Wechsel zwischen Routen möglicherweise aus dem Browsercache bedient.

| Route | JS vorher | JS nachher | gzip vorher | gzip nachher | gzip weniger |
| --- | ---: | ---: | ---: | ---: | ---: |
| Übersicht | 601.363 B | 573.803 B | 178.804 B | 171.891 B | 3,9 % |
| Modulübersicht | 625.408 B | 593.806 B | 187.264 B | 179.132 B | 4,3 % |
| Lektion | 614.409 B | 587.760 B | 182.976 B | 176.391 B | 3,6 % |
| Indikatoren | 938.591 B | 756.938 B | 276.336 B | 223.135 B | 19,3 % |

Messwerte und Build-IDs: [mentorship-audit-2026-09-05.json](mentorship-audit-2026-09-05.json). `npm run measure:mentorship` reproduziert die Auswertung des jeweils vorhandenen Produktions-Builds; fehlende Dateien führen zu einem Fehler und werden nicht still übersprungen.

## Verifikation und Arbeitsablauf

- `npm run lint` und `npm run typecheck`: bestanden; der finale Build prüft TypeScript ebenfalls.
- `npm test`: alle 47 bestehenden Tests bestanden. Der HTTP-Upload-Test lief mit einem temporären lokalen Testserver.
- Produktions-Build: bestanden. Sora wurde beim frischen Vergleichs-Build von Google Fonts geladen. Meldungen zu nicht erreichbarer Datenbank und ungültigem Stripe-Platzhalter waren erwartete Grenzen dieses lokalen Builds; Dienstanbindungen wurden damit nicht bestätigt.
- Lokale UI-Prüfung mit den tatsächlichen Komponenten und Beispieldaten: 63 Prüfungen bestanden, keine JavaScript-Ausnahmen. Zusätzlich wurde eine sichtbare 2-Pixel-Fokusmarkierung per Tastatur geprüft.
- Geprüfte Breiten: 1440, 1024, 390 und 320 Pixel. Screenshots wurden für Desktop, Tablet und Smartphone sowie helle und dunkle Darstellung gesichtet. Keine horizontale Überbreite oder kaputten Bilder in den geprüften Ansichten.
- Interaktionen: Suche und Rücksetzen, leere Modulliste, fehlender Fortschritt, Menü öffnen/schließen, Escape und Fokusrückgabe, Navigation, gespeicherte Darstellungspräferenz, direkter Lektionslink, vorhandener PDF-Link, Fehler und Wiederholung beim Speichern, aktualisierte Inhaltsübersicht, nächste und letzte Lektion sowie Indikator-Anleitung.
- Reduzierte Bewegung: Eintrittsanimationen sind im geprüften Zustand deaktiviert.

Die Browserprüfung war auf die lokale Vorschau beschränkt; externe Anfragen waren blockiert. Kontoverknüpfung, Stripe-Portal, echte Fortschrittsspeicherung und Bunny-Wiedergabe wurden nicht auf Produktivsystemen ausgelöst. Die Vorschau verwendete weiterhin die vorhandenen privaten Vergleichsschriften. Es besteht keine Aussage zur vollständigen Barrierefreiheit oder zum Verhalten aller realen Kundenkonten.

Die neuen Befehle `typecheck`, `test` und `measure:mentorship` sind im [README](../README.md) beschrieben. Für eine spätere Freigabe mit realen Diensten bleibt eine authentifizierte Testumgebung mit Testdaten nötig; die lokale Designvorschau deckt diesen Teil nicht ab.

## Offene PRs und Issues

Die finale Liste stammt direkt aus `gh pr list`, `gh pr view` und `gh issue list`. Die verbundene Suchfunktion lieferte zuvor ein unvollständiges, auch auf PR-Filter nicht korrekt reagierendes Ergebnis.

Alle drei offenen PRs zielen auf `dev` und benötigen eine Review. Ihre aufgeführten Vercel-/GitGuardian-Checks sind erfolgreich; das ersetzt keine Prüfung gegen den heutigen Mentorship-Stand.

| PR | Befund | Einordnung |
| --- | --- | --- |
| [#146: Automatic cinematic mesh-gradient covers for Mentorship chapters](https://github.com/Petar-23/PAT-Mentorship-25-Webpage/pull/146) | Draft, technisch gegen `dev` zusammenführbar; Cover-Generator, 48 Farbmotive und Änderungen an mehreren jetzt neu gestalteten Lernkomponenten. | Überschneidet sich mit der aktuellen Bildwelt und ist ein Kandidat zum Verwerfen der älteren Designrichtung. Keine automatische Übernahme. |
| [#147: Add source question to PAT Mentorship Checkout](https://github.com/Petar-23/PAT-Mentorship-25-Webpage/pull/147) | Konflikte gegen `dev`; Änderungen an Checkout-Herkunftsfrage und Stripe-Verarbeitung. | Eigenständige Funktion mit Konfliktauflösung und Checkout-/Webhook-Prüfung. Kein einfacher Merge. |
| [#97: feat: World Watch — strike arc/target fix + Sidebar type error](https://github.com/Petar-23/PAT-Mentorship-25-Webpage/pull/97) | Konflikte gegen `dev`; zahlreiche World-Watch-Dateien, außerdem Middleware, Abhängigkeiten und Stripe-Verarbeitung. | Breiter separater Arbeitsstrang. Ein Übernehmen würde die Mentorship-Änderung erheblich erweitern. |

Ein offenes [Issue #1](https://github.com/Petar-23/PAT-Mentorship-25-Webpage/issues/1) fordert E-Mail-Benachrichtigungen bei Anmeldung oder Kündigung. Die Erfüllung dieser Anforderung wurde hier nicht funktional geprüft; es bleibt offen.

Dies ist eine Triage nach aktuellem GitHub-Status und Dateiumfang, kein vollständiger Code-Review der fremden Branches. Es wurden keine PRs oder Issues verändert und kein Merge, Push oder Deployment ausgeführt.
