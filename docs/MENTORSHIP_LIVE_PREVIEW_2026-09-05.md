# Echte Inhalte in der lokalen Mentorship-Vorschau

Historischer Prüfstand vom 5. September 2026. Aktuelle Gestaltung und Produktionsumfang stehen in [MENTORSHIP_DESIGN.md](MENTORSHIP_DESIGN.md) und [PR-Verifikation](MENTORSHIP_PR_VERIFICATION_2026-09-06.md).

Die Vorschau unter `http://127.0.0.1:3017/mentorship` enthält fünf echte Kurse, 21 Module, 32 Kapitel und 94 Lektionen. 93 Lektionen haben eine Bunny-Video-ID; 35 besitzen PDF-Unterlagen. Alle 21 Modulkarten verwenden neu generierte Motive derselben Bildserie.

## Daten und Medien

Der Adapter liegt ausschließlich in `/private/tmp/pat-mentorship-preview`. Er liest den vorhandenen lokalen Datenbankzugang im Arbeitsspeicher und lädt den Kurskatalog in einer expliziten PostgreSQL-Lesetransaktion. Er liest keine Kundenprofile oder persönlichen Fortschritte. Der Cache gilt für 60 Sekunden. Der Server ist nur an `127.0.0.1:3017` gebunden.

Abschluss und zuletzt geöffnete Lektion werden ausschließlich in einer lokalen Vorschaudatei gespeichert. Andere Schreibendpunkte sind gesperrt. Persönliche Kontoaktionen und geschützte Downloads verweisen auf das bestehende PAT-Konto. Die Anmeldung erfolgt dort über den normalen Browser; dadurch landet man nach der Anmeldung auf der Produktionsseite. Die Vorschau selbst bleibt lokal.

Die 24 bereits öffentlichen PDF-Originaladressen werden aus dem Katalog übernommen. Alle 24 lieferten beim Abruf HTTP 206 und die Signatur `%PDF-`. Elf weitere Links verwenden den bestehenden geschützten PAT-Download. Der private Raid-Map-Download wurde mit dem angemeldeten Kundenkonto tatsächlich geladen und anhand Dateigröße und PDF-Signatur geprüft. Die übrigen zehn geschützten Dateien wurden über ihre exakte Zuordnung im UI geprüft, nicht vollständig heruntergeladen.

Beim Versuch, die beiden ältesten öffentlichen PDF-Adressen durch den geschützten Produktionsendpunkt zu ersetzen, lieferte dieser „Not found“. Deren historisches Schema lautet `pdfs/<videoId>-<filename>.pdf`; der aktuelle Kompatibilitätshelfer akzeptiert `pdfs/<videoId>/<filename>.pdf`. Die lokale Vorschau bewahrt deshalb die gespeicherten Originaladressen. An Produktionsrouten oder Zugriffsregeln wurde nichts geändert.

Die Vorschau verwendet die konfigurierte Bunny-Bibliothek mit den echten Video-IDs. Bunny zeigt für die lokale Einbettung unter `127.0.0.1` und `localhost` einen sichtbaren 403. Funktionierende Videowiedergabe ist damit nicht bestätigt.

Die tatsächliche Wiedergabe bleibt auf einer für private Medien zugelassenen und authentifizierten Umgebung zu prüfen. Die Vorschau ändert keine Einbettungsregeln oder Schutzfunktionen.

## Episodenzeilen und Apple-Richtlinien

Alle Episodenzeilen reservieren zwei Titelzeilen und eine Zusatzzeile. Fehlende Laufzeiten, einzeilige Titel, Auswahl und Abschluss verändern ihre Höhe nicht mehr. Die Höhe beträgt bei Standardschrift rund 85,4 Pixel und wächst mit der Schriftgröße. Der vollständige Titel bleibt im zugänglichen Namen, im Tooltip und in der Playerüberschrift erhalten. Auswahlflächen und Modulkarten verwenden einen gemeinsamen Radius von 12 Pixeln; Buttons behalten 8 Pixel und größere Flächen 16 Pixel. Die Ladeansicht folgt derselben Geometrie.

Die Umsetzung folgt den Grundsätzen konsistenter Listen, lesbarer Hierarchie, ausreichender Trefferflächen und sichtbarer Interaktionszustände aus Apples [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) und [Typography](https://developer.apple.com/design/human-interface-guidelines/typography). Die gewählten Radien und identischen Zeilenhöhen sind konkrete Entscheidungen für PAT; Apple schreibt diese Pixelwerte nicht allgemein vor.

## Bildserie und Icons

Die 21 WebP-Motive liegen unter `public/images/mentorship/modules/`, jeweils 1200 × 675 Pixel. `mentorship-module-artwork.json` hält die Zuordnung zu den echten Modul-IDs und die Erzeugungsprompts fest. Die Bilder sind dekorative Marktillustrationen. Vorhandene Datenbankbilder wurden nicht überschrieben; die Zuordnung gilt derzeit für die lokale Vorschau.

[Phosphor](https://phosphoricons.com/) nennt Anthropic ausdrücklich als Nutzer. Das ist ein Nachweis für Anthropic insgesamt, aber kein belastbarer Nachweis, dass die [Claude-iPhone-App](https://apps.apple.com/us/app/claude-by-anthropic/id6473753684) ausschließlich Phosphor verwendet. Die offiziellen [Claude Design Guidelines für MCP Apps](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines) empfehlen monochrome Umrissicons, benennen jedoch keine Bibliothek der nativen iPhone-App. Die bestehende PAT-Iconbibliothek wurde deshalb nicht aufgrund einer unbestätigten Annahme ersetzt.

## Verifikation

59 Browserprüfungen bestanden, 34 Ansichten gerendert: fünf echte Kursraster, alle 94 Lektionstitel, alle 35 exakten PDF-Zuordnungen, Kapitel und Modulsuche, einheitliche Zeilenhöhen bei 320/390/768/1024/1440 Pixeln in Hell und Dunkel sowie bei verdoppelter Schriftgröße. Lokaler Fortschritt ließ sich speichern und zurücksetzen. Unbekannte Schreibzugriffe, ungültige Nutzlasten und fremde Ursprünge wurden abgewiesen. Keine externen Schreibanfragen und keine Browserausnahmen im Prüfablauf.

TypeScript-Prüfung für Quellprojekt und Vorschau sowie ESLint für die veränderten React-Komponenten bestanden. Der Browserdurchlauf sperrte externe Playeranfragen; er ist ausdrücklich kein Nachweis für Videowiedergabe. Der echte Bunny-403 wurde separat im Browser beobachtet. Die Änderungen wurden weder veröffentlicht noch committed oder gepusht.
