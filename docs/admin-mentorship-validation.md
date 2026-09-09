# Mentorship-Verwaltung: Umsetzung und Prüfung

Stand: 09.09.2026. Arbeitszweig: `codex/admin-mentorship-pdf`, Basis `bdecbd52`.

## Ergebnis

Die Inhaltsverwaltung verwendet den bestehenden Mentorship-App-Rahmen mit PAT-Schriften, kompakter Kursnavigation und klaren Kapitel-/Lektionszeilen. Verwaltungsaktionen liegen am jeweiligen Inhalt. Die Admin-Navigation und Kapitelwerkzeuge stehen auch auf kleinen Bildschirmen bereit. Dialoge und Menüs übernehmen Schriften und Farbvariablen aus dem App-Rahmen.

Die PDF-Datei geht direkt an den privaten Blob-Speicher. Zwei kleine JSON-Anfragen autorisieren den Upload und speichern die geprüfte Zuordnung. Der Server prüft Berechtigung, Lektion, Dateigröße, Objektpfad, MIME-Typ und PDF-Signatur. Parallele Änderungen überschreiben keine neueren Unterlagen. Fortschritt, Abbruch, Wiederholung und Fehlerzustände sind in der Oberfläche sichtbar; Erfolg wird erst nach bestätigtem Speichern gemeldet. Auch der vorhandene Upload-Helfer verwendet den neuen Transportweg.

Es gibt keine neue Abhängigkeit, Datenbankmigration oder Umgebungsvariable. Der bestehende private Blob-Zugang und geschützte Download bleiben erhalten. Der Hauptcheckout mit fremden Änderungen wurde nicht bearbeitet.

## Technische Prüfung

- 85 Tests erfolgreich, einschließlich 13 neuer Tests für PDF-Upload und Dateizuordnung.
- Der Transporttest verwendet ein tatsächliches `File` mit 5.739.687 Bytes. Die Datei erreicht den Blob-Client unverändert; beide Function-Anfragen enthalten jeweils weniger als 1 KB JSON.
- Abgedeckt: Rollen und Agent-Zugang, 25-MB-Grenze, fehlende Lektion, ungültige Dateidaten und fremde Objektpfade, beschädigte PDF-Signatur, Speicher-/Datenbankfehler, Abbruch, konkurrierende Änderungen und wiederholte Abschlussanfragen.
- Typprüfung und ESLint für die geänderten TypeScript-/JavaScript-Dateien erfolgreich.
- Produktionsbuild erfolgreich mit Testzugängen und isolierter lokaler Datenbank. Das ist kein Test der echten Clerk-/Stripe-Dienste.
- `git diff --check` erfolgreich. `origin/main` beim abschließenden Abruf unverändert auf der verwendeten Basis.

## Prüfung mit dem NYPM-Protokoll

Die Originaldatei hat 39 Seiten und 5.739.687 Bytes. Erster und letzter Chart wurden visuell geprüft. Der bisherige Multipart-Transport kollidiert bei dieser Größe mit Vercels dokumentierter 4,5-MB-Grenze. Eine konkrete produktive HTTP-413-Antwort wurde nicht beobachtet.

In der lokalen Vorschau wurde genau diese Datei über den Dateiauswahldialog hochgeladen, der Lektion zugeordnet, nach Neuladen angezeigt und über die echte Download-Route wieder abgerufen. Blob und Anmeldung sind in dieser Umgebung simuliert; Datenbank und Anwendungsrouten werden tatsächlich ausgeführt.

- Download: HTTP 200, `application/pdf`, `private, no-store, max-age=0`.
- Dateigröße und Bytes identisch mit dem Original.
- SHA-256: `865e15c3dd585fc3fa22b607f371b21c3a9f9e03bc68f67551a9e1c4733e9124`.
- Lektionsname, Bunny-ID und 2.058 Zeichen Shownotes unverändert.
- Simulierter Speicherfehler und abgebrochener Ersatzupload lassen die bisherige PDF-Zuordnung erhalten. Fehler und Wiederholen erscheinen direkt beim Upload.

## Oberfläche und Grenzen der Vorschau

Geprüft wurden die helle Desktopansicht bei 1.280 und 1.440 Pixeln, die helle Mobilansicht bei 320 und 390 Pixeln sowie die dunkle Darstellung bei 390 und 1.440 Pixeln. Die dokumentierten Ansichten haben keinen horizontalen Überlauf. Mobile Navigation, Kursdialog, Rückkehr des Tastaturfokus, Sortieren der Kurse per Tastatur, Kapitelsortierung, Kapitelumbenennung einschließlich fehlgeschlagenem Speichern und erneutem Versuch sowie Anlegen und Umbenennen einer synthetischen Testlektion wurden lokal geprüft. Die synthetischen Datensätze wurden danach wieder entfernt.

Die abschließende Löschdialog-/Klickprüfung wurde durch eine blockierende native Bestätigung im Browser unterbrochen; deren Abschluss ist noch offen. Die dunklen Screenshots wurden deshalb mit einer vorübergehend dunklen Startdarstellung in der lokalen Vorschau aufgenommen. Diese Vorschau-Einstellung wurde anschließend zurückgesetzt. Daraus wird kein erfolgreicher abschließender Test des Theme-Schalters oder der Löschung abgeleitet.

Der Player zeigt in dieser Vorschau ein gekennzeichnetes Standbild aus der echten Aufnahme. Die lokale Herkunft wird vom Bunny-Embed nicht zugelassen. Die Vorschau beweist daher weder Live-Wiedergabe noch einen erfolgreichen Upload zum echten Blob-Dienst. Die neue Oberfläche und die PDF-Zuordnung wurden noch nicht produktiv veröffentlicht.

## Ausstehende Freigabe

Vor Veröffentlichung verbleiben die abschließende Dialogprüfung und die konkrete Freigabe für die neue Admin-Oberfläche samt Upload-Reparatur. Das tatsächliche Anhängen von `NYPM - Protokoll.pdf` an `PM-Tape-Reading 08.09.2026` wurde von der automatischen Freigabeprüfung abgelehnt, weil Datei und Ziellektion dafür noch nicht ausdrücklich freigegeben wurden. Nach Freigabe sind der echte private Upload, die genaue Zuordnung und der geschützte Download mit Bytevergleich erneut zu prüfen.

Quellen: [Vercel Function Payload Limit](https://vercel.com/docs/errors/function_payload_too_large), [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).
