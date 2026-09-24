# PAT: kleine Performance-Verbesserungen, 24. September 2026

## Status und Umfang

Lokal implementiert und mit Tests sowie Produktionsbuild geprüft; **nicht veröffentlicht und noch nicht für den Livebetrieb freigegeben**. Die authentifizierte Browserprüfung und echte Vorher-/Nachher-Seitenzeiten fehlen noch.

Basis: frisch geholtes `origin/main`, Commit `236063c25fc22d223968963c8bc1f01606a5bc27`. Dieser Stand ist nicht als exakter aktuell ausgelieferter Produktionscommit verifiziert. Separater Branch `codex/performance-20260924`; der bereits stark veränderte ursprüngliche Arbeitsordner blieb unberührt.

Der [Claude-Artikel](https://claude.dev/blog/how-we-made-claude-ai-faster/) dient als methodische Vorlage: konkrete Abläufe messen, unnötige Arbeit entfernen und vorhandenes HTML früh benutzbar machen. Seine Beschleunigungsfaktoren sind nicht auf PAT übertragbar. Keine neuen Abhängigkeiten, kein Redesign, keine Schemaänderung. Authentifizierung, Berechtigungen, Zahlungen, Videozugriff und die Speicherung des Lernfortschritts bleiben unverändert.

## Änderungen und Nachweise

### 1. Eine Schrift weniger sofort laden

`app/layout.tsx`: Nur für Geist Mono wurde `preload: false` ergänzt. Die Schrift bleibt vorhanden und kann bei tatsächlicher Verwendung geladen werden. Geist Sans, die auf der Startseite verwendete Sora sowie die Mentorship-Schriften bleiben unverändert.

| Schrift-Preloads im Startseiten-HTML | Vorher | Nachher |
| --- | ---: | ---: |
| Dateien | 3 | 2 |
| Summe der Dateigrößen | 159.372 B | 91.508 B |

Entfallen: Geist Mono, 67.864 B, also 42,6 % der bisherigen **Schrift-Preload-Bytes**, nicht der gesamten Seite. Dateinamen der verbleibenden Preloads: `3dc379dc9b5dec12-s.p.woff2` (25.240 B) und `4473ecc91f70f139-s.p.woff` (66.268 B). Der entfernte Preload war `463dafcda517f24f-s.p.woff`.

### 2. Kurszählung in der Mentorship-Übersicht zusammenführen

`lib/mentorship-dashboard.ts`: Die Kapitelabfrage liefert die Anzahl ihrer Lektionen direkt mit. Die separate Gruppierungsabfrage entfällt. Bei leerer Kursliste entfallen alle Datenzugriffe dieses Loaders. Persönlicher Fortschritt bleibt pro Nutzer abgefragt; es wurde kein nutzerübergreifender Cache ergänzt.

Zusätzlicher Vergleich mit echtem Prisma 7.1.0 und der vorhandenen `.env.local`-Datenbankverbindung:

- Nur Kurs-IDs und Lektionszahlen gelesen, keine Mitgliederdaten und keine Schreiboperationen.
- PostgreSQL-Verbindung mit `default_transaction_read_only=on`; der Read-only-Status wurde vorab geprüft. Abfragen hatten ein 5-Sekunden-Limit.
- Poolgröße 1, entsprechend dem Code-Default. Je ein Aufwärmlauf, danach fünf Läufe pro Variante in wechselnder Reihenfolge. Gemessen wurde vom lokalen Rechner über die bestehende Verbindung, nicht aus der Produktionsregion.
- Beide Varianten lieferten in allen Läufen identische Kurszählungen.
- Die Verbindung stammt aus der lokalen Konfiguration. Ihre Übereinstimmung mit der aktuell von Vercel verwendeten Produktionsdatenbank wurde nicht geprüft.

| Lauf | Alte Kurszählung | Neue Kurszählung |
| --- | ---: | ---: |
| 1 | 42,06 ms | 30,49 ms |
| 2 | 43,21 ms | 28,20 ms |
| 3 | 62,78 ms | 28,50 ms |
| 4 | 39,94 ms | 27,54 ms |
| 5 | 48,79 ms | 27,08 ms |
| Median | 43,21 ms | 28,20 ms |

Prisma-Query-Events: vorher 3 SQL-Abfragen, nachher 2. Rund 15 ms beziehungsweise 35 % weniger Zeit **für diesen isolierten Teilschritt in dieser kleinen Stichprobe**. Das belegt weder eine 35 % schnellere Mentorship-Seite noch bessere p75-Ladezeiten. Im Unit-Test mit einem Kurs benötigt der gesamte Loader 5 statt 6 Prisma-Aufrufe für ein Mitglied und 2 statt 3 für die administrative Übersicht; reale SQL-Abfragen und Prisma-Aufrufe sind nicht dasselbe.

### 3. Einstiegsbutton vor dem Login-Dienst benutzbar machen

`components/sections/mentorship-entry-cta.tsx`: Solange Clerk noch lädt, wird statt eines deaktivierten Buttons ein normaler Link zur Anmeldung mit Rückkehrziel `/dashboard` ausgegeben. Next Link erzeugt dafür bereits im serverseitigen HTML einen Anker; `prefetch={false}` vermeidet zusätzliche Authentifizierungsabrufe. Nach dem Laden bleiben der bisherige Anmeldedialog und der Mitgliederbutton erhalten.

Im gebauten Startseiten-HTML wurden drei entsprechende Links gefunden, ohne `disabled` oder `aria-disabled="true"`. Die Button-Stile bleiben erhalten; der bisherige deaktivierte Zustand entfällt bewusst. SSR-Tests prüfen zusätzlich alle drei Auth-Zustände. Der tatsächliche Klick und die Rückkehr nach echter Anmeldung sind noch nicht im Browser bestätigt.

## Vergleich der Builds

Beide Builds verwenden dieselben Lockfile-Abhängigkeiten: Next 16.1.4, React 18.3.1 und Prisma 7.1.0.

- Vorher: `JTlDfgrExgvZkzBl4BEA-`
- Nachher: `yXvmKSH2K-8vXBt5vlf-R`

`npm run measure:mentorship` zählt jede von einer Route referenzierte JavaScript-Datei einmal und erfasst jetzt zusätzlich Startseite und Font-Preloads. Die Zahlen sind Dateigrößen, keine tatsächlich übertragenen oder beim ersten Seitenaufruf ausgeführten Bytes.

| Route | JS vorher | JS nachher | gzip vorher | gzip nachher |
| --- | ---: | ---: | ---: | ---: |
| `/` | 487.213 B | 486.564 B | 141.818 B | 141.515 B |
| `/mentorship` | 634.724 B | 634.075 B | 182.377 B | 182.074 B |
| `/mentorship/[id]` | 658.244 B | 657.595 B | 191.015 B | 190.712 B |
| `/mentorship/modul/[id]` | 646.089 B | 645.440 B | 186.089 B | 185.786 B |
| `/mentorship/indicators` | 814.211 B | 813.562 B | 232.827 B | 232.524 B |

Die kleinen JS-Unterschiede sind kein belastbarer Nachweis einer merklich schnelleren Seite. Bestehende Lazy-Loading- und Sidebar-Cache-Lösungen wurden beibehalten, statt weitere Cache-Ebenen einzuführen. Persönliche Zugriffsprüfungen wurden nicht entfernt.

## Öffentliche Live-Stichprobe vor Änderungen

Drei reine HTTP-GETs pro Route vom lokalen Rechner; dies misst TTFB, nicht LCP, INP, vollständigen Seitenaufbau oder einen Mobilfunk-Kaltstart:

- Startseite, HTTP 200: 89 / 74 / 93 ms, jeweils 348.784 B HTML.
- Blog, HTTP 200: 230 / 309 / 102 ms.
- Mentorship ohne Anmeldung, HTTP 307: 65 / 74 / 66 ms. Das ist ausschließlich die Weiterleitung zur Anmeldung, **keine Messung des Mitgliederbereichs**.

## Durchgeführte Prüfungen und Grenzen

- Vollständiges `npm run lint`: bestanden, keine ausgegebenen Warnungen oder Fehler.
- `npm run typecheck`: bestanden.
- `npm test`: 94/94 bestanden, darunter 9 neue Tests für Kurszählung, Reihenfolge, leere Kurse, unterschiedliche Nutzer, Fehler und den Einstiegslink. Ein bestehender Upload-Test verwendet ausschließlich einen lokalen HTTP-Testserver.
- `npm run build`: erfolgreich mit Platzhalterzugängen; erwartete Meldungen über die absichtlich unerreichbare Platzhalterdatenbank und fehlenden Stripe-Schlüssel. Keine Migrationen ausgeführt. Der Build ist kein Nachweis funktionierender Anbieteranbindungen.
- `git diff --check`: bestanden; keine Änderungen an Abhängigkeiten oder Lockfile.
- Live-Browser: öffentliche Startseite und Weiterleitung von `/mentorship` zur Anmeldung bestätigt. Keine angemeldete Testsitzung vorhanden.
- Lokaler Browser: der Produktionsserver startet, aber der Browser blockiert dessen URL mit `ERR_BLOCKED_BY_CLIENT`. Daher kein bestandener visueller oder responsiver Nachher-Test. Desktop-/Mobil-Layout, echter Anmeldeabschluss und Tastaturbedienung bleiben offen.

## Vor einem Release

1. Angemeldete Testumgebung und erreichbaren Vorschau-Browser verwenden; zuerst Login → Übersicht → Kurs → Lektion prüfen. Desktop und Mobil, Video/PDF, Weiterlernen, Zurücknavigation und persönlicher Fortschritt separat kontrollieren.
2. Vorher und nachher mit denselben Konten, Daten und Geräten messen: Kalt-/Warmstart, LCP/INP und Navigation bis zum benutzbaren Inhalt. Die obigen Mikro-Messwerte nicht als Gesamtseiten-Ergebnis verwenden.
3. Erst nach diesen Prüfungen und Veröffentlichungsfreigabe über einen PR ausrollen; denselben Ablauf danach gegen die tatsächliche Live-Version wiederholen. Für diese Aufgabe wurde nichts gepusht, gemergt oder bereitgestellt.
