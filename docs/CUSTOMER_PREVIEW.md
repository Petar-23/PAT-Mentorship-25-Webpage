# Kundenvorschau für den Support

Stand: 8. Oktober 2026. Lokal implementiert und geprüft; noch nicht veröffentlicht.
Basis: `origin/main` bei `bd14cae2`, isolierter Worktree `customer-preview`.

## Bedienung

1. In der Verwaltung auf **Als Kunde ansehen** klicken (`/owner/customer-preview`).
2. Die vollständige primäre E-Mail-Adresse suchen und das gefundene Kundenkonto öffnen.
3. Übersicht, Kurse, Module, Videos, PDFs und den gespeicherten Lernfortschritt prüfen.
4. Die gelbe Leiste zeigt jederzeit den Kunden und **Nur lesen**. **Vorschau beenden** führt zurück zur Kundensuche.

Der Browser bleibt mit dem echten Admin-Konto angemeldet. Es werden keine Clerk-Impersonation-Tokens erstellt, Rollen vergeben oder Kundensitzungen übernommen.

## Berechtigungen

| Echte Rolle | Kundensuche und Vorschau | Änderungen am Kunden |
| --- | --- | --- |
| Nicht angemeldet | Nein | Nein |
| Mitglied | Nein | Nein |
| Admin einer anderen Clerk-Organisation | Nein | Nein |
| Admin der konfigurierten PAT-Organisation | Ja | Nein, Vorschau ist schreibgeschützt |

Die neue Fähigkeit prüft Mitgliedschaften serverseitig gegen `CLERK_ADMIN_ORGANIZATION_ID` und `org:admin`. Ein bloßer Admin-Claim oder eine Adminrolle in irgendeiner Organisation genügt nicht. Ohne Konfiguration bleibt die Funktion geschlossen. Diese Änderung ist keine Umstellung aller bestehenden Admin-APIs auf ein neues RBAC-System.

Jede angeforderte Kundenseite prüft den tatsächlichen Admin erneut, bevor Kundendaten und Kursinhalte geladen werden. React-Cache dedupliziert nur innerhalb eines Server-Renderings. Ziel-ID und Zieladresse stammen aus Clerk. Nur die verifizierte primäre Kundenadresse darf beim Abo-Fallback verwendet werden; die Adresse oder Admin-Freigabe des angemeldeten Admins wird nicht übernommen.

## Lesemodus und Grenzen

- Übersicht, Kurs und Modul nutzen dieselben Server-Views und Schüler-Komponenten wie die normale Mentorship. Zugriff und Fortschritt werden für das Zielkonto gelesen.
- Derselbe Abo-Check läuft mit `readOnly: true`: keine Stripe-Metadaten-Verknüpfung und keine DB-Cache-Upserts. PayPal-, Stripe-, Preis-, Laufzeit- und Startdatumsregeln bleiben erhalten.
- Kein Speichern von „zuletzt angesehen“, manuellem oder automatischem Lernfortschritt. Die Gegenprobe ohne Vorschau bestätigt, dass diese Funktionen für normale Mitglieder erhalten bleiben.
- Kontoeinstellungen, Mitgliedschaft, Kündigung, Community-Verknüpfung, Indikatoren und freie Inhaltsseiten sind in dieser ersten Vorschau gesperrt. Interne Shownote-Links zu unterstützten Kursen/Modulen bleiben in der Vorschau; andere Links werden deaktiviert.
- Der explizite Einstieg aus dem Admin-Dashboard lädt vollständig neu. Analytics und Session-Replay werden auf Vorschauseiten nicht eingebunden. Antworten sind `private, no-store`; Referer enthalten nur den Ursprung.
- Der Server protokolliert `customer_preview_open` mit tatsächlicher Admin-ID, Ziel-ID, Zugangsentscheidung und Zeitpunkt, ohne E-Mail-Adresse oder Abo-Details.
- PDFs und Videos verwenden den bestehenden Medienpfad. Es gibt keine Sitzung als Kunde für beliebige andere APIs. Diese Vorschau reproduziert die Schüleroberfläche und Zugangsentscheidung, aber nicht Safari-Einstellungen, Erweiterungen, Cookies oder Netzwerkprobleme auf dem Kundengerät.

## Prüfung

- Gesamte Node-Testsuite: **344/344 bestanden**, einschließlich der neuen Berechtigungs-, Abo- und Shownote-Regressionen.
- TypeScript, gezieltes ESLint, `git diff --check` und Next-Produktionsbuild bestanden. Der Build lief ohne Produktionszugang, mit syntaktischem Dummy-Clerk-Publishable-Key. Prisma wurde nur generiert; keine Migration wurde ausgeführt.
- Unabhängige Codeprüfung: ein Navigationsfehler in Shownote-Links und ein Fehlerfall bei ungültigen URLs wurden gefunden, korrigiert und mit Regressionen abgesichert. Kein externer Cross-Modell-CLI-Aufruf.
- Lokaler Browser-Test mit erfundenem Kunden und lokalem Testiframe: Übersicht → Kurs → Modul, Lektionswechsel, gesperrte Kontofunktionen und enges Fenster (1.000 Pixel). Vorschau: **0 Schreibanfragen**, auch bei simuliertem Videoende. Gegenprobe im normalen Mitglieder-Modus: **1** Anfrage beim Öffnen, **2** nach Videoende, Fortschritt von 50 auf 100 Prozent. Alle API-Aufrufe waren lokal abgefangen; keine Kundendaten verändert.
- Beobachtung bei weniger als 1.024 Pixeln: Zunächst wird die Lektionsliste angezeigt; Klick auf die Lektion öffnet den Player. Das ist bestehendes Verhalten, eine mögliche Erklärung für den Supportfall, kein bestätigter Safari-Fehler.

## Noch vor Live-Nutzung

1. Den tatsächlich aktiven Produktionsstand mit diesem Branch abgleichen. Andere unveröffentlichte Änderungen des Haupt-Checkouts sind hier nicht enthalten.
2. Die bestehende PAT-Clerk-Organisation identifizieren und ausschließlich deren ID als `CLERK_ADMIN_ORGANIZATION_ID` konfigurieren. Keine zusätzliche Organisation oder Adminrolle anlegen.
3. Nach Freigabe veröffentlichen und mit dem vorhandenen PAT-Admin ein Kundenkonto öffnen. Nicht-Admin- und falsche Organisationsrolle müssen weiter gesperrt bleiben.
4. Im konkreten Supportfall den aktiven Kundenstatus, die März-Lektionen und echte Wiedergabe/PDFs prüfen. Die lokale Testansicht belegt keine echte Bunny-Wiedergabe oder Safari-Kompatibilität auf dem Kundengerät.

Keine E-Mail versendet, keine Kundenrolle geändert, kein Abo verändert und kein Produktionsdeploy ausgeführt.

Vercel-Leseprüfung: `www.price-action-trader.de` zeigt auf das READY-Deployment `dpl_FYLJYDpQe7P85DKnLUAkVM7gSDmg`. Die CLI lieferte keinen Git-SHA (`gitSource`/`meta` nicht enthalten); damit ist die exakte Gleichheit von Live-Quellstand und Branch-Basis noch nicht belegt. Keine Produktions-Umgebungsvariablen exportiert.

Der letzte Build lief erfolgreich mit Cache auf `/Volumes/SSD_2TB/Codex-build-cache/customer-preview-20261008`, nachdem der interne Datenträger vollgelaufen war. Die Codeänderungen liegen weiterhin im isolierten Worktree. Temporäre lokale Installations- und Build-Ausgaben können gelöscht und mit `npm ci` / `prisma generate` / `npm run build` neu erzeugt werden.
