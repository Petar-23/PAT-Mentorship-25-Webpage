# Arbeitsauftrag: Mentorship-Verwaltung und PDF-Upload

## Problem und Ziel

Die Verwaltungsansicht verwendet für Navigation, Kapitel und Lektionen noch die alte Oberfläche. Große Banner, verschachtelte Karten, uneinheitliche Symbole und dauerhaft sichtbare Löschaktionen erschweren die tägliche Inhaltsarbeit. Die Mitgliederansicht besitzt bereits die passende PAT-Gestaltung. Die Verwaltung soll dieselben Schriften, Farben, Abstände und Navigationsmuster verwenden und ihre Werkzeuge klar am jeweiligen Inhalt anbieten.

Der PDF-Upload akzeptiert laut Oberfläche 25 MB, sendet die Datei aber vollständig durch eine Vercel Function. Das genannte NYPM-Protokoll hat 5.739.687 Bytes und 39 Seiten. Der bisherige Transportweg kollidiert mit Vercels 4,5-MB-Grenze für Request-Bodies; die Oberfläche zeigt nur einen allgemeinen Fehler.

## Umsetzung

1. Mentorship-Inhaltsverwaltung auf den vorhandenen App-Rahmen ausrichten: kompakte Kursnavigation, klare Kapitel- und Lektionsliste sowie großzügige Arbeitsfläche für Video, Unterlagen und Shownotes. Aktueller Kurs, Modul und Lektion bleiben eindeutig erkennbar.
2. Verwaltungswerkzeuge am betreffenden Eintrag bündeln. Kurse, Seiten, Module, Kapitel und Lektionen müssen weiterhin angelegt, umbenannt und sortiert werden können. Löschen benötigt eine eindeutige Bestätigung; neue Verwaltungswerkzeuge sind auf Deutsch beschriftet.
3. PDF-Dateien direkt in den bestehenden privaten Blob-Speicher übertragen. Die Webseite autorisiert den konkreten Upload und bestätigt erst nach Dateiprüfung und gespeicherter Zuordnung den Erfolg. Das 25-MB-Limit, der geschützte Download und die bestehende Berechtigungsprüfung bleiben Teil des Vertrags.
4. Dateiname, Fortschritt, Abbrechen, Wiederholen und konkrete Fehler verständlich anzeigen. Bei einem Lektionswechsel darf ein laufender Upload nicht versehentlich der neuen Lektion zugeordnet werden. Bestehende Unterlagen bleiben bei einem Fehler erhalten.
5. Das unveränderte NYPM-Protokoll der Lektion „PM-Tape-Reading 08.09.2026“ zuordnen und Dateiintegrität sowie geschützten Zugriff prüfen.

## Abnahme

- PDF-Fehler anhand von Datei, bisherigem Transportweg und Plattformgrenze eingegrenzt; Regression für Dateien oberhalb 4,5 MB bis zur erlaubten Grenze abgesichert. Einen tatsächlich beobachteten HTTP-413-Fehler nur bei entsprechender Antwort behaupten.
- Ungültige Dateien, fehlende Berechtigung, fehlende Lektion, Upload-/Speicherfehler und konkurrierende Änderungen führen zu verständlichen Antworten und keiner falschen Erfolgsmeldung.
- Desktop und schmale Mobilansicht sowie helles/dunkles Design, Tastaturbedienung und die wesentlichen Verwaltungsaktionen geprüft.
- Bestehende Komponenten und Designvariablen wiederverwendet; unabhängige Änderungen im Hauptverzeichnis erhalten.
- Konkrete Vorschau, fokussierte Tests, Typprüfung, relevanter Lint-Lauf und Produktionsbuild vor der Freigabe.

## Freigabestatus

Die Umsetzung und Prüfung erfolgen in einer isolierten lokalen Arbeitskopie. Veröffentlichung und tatsächliches Anhängen von „NYPM - Protokoll.pdf“ an „PM-Tape-Reading 08.09.2026“ benötigen noch die konkrete Freigabe. Die automatische Freigabeprüfung hat den produktiven Wiederholungsupload abgelehnt, weil Datei und Ziellektion dafür noch nicht ausdrücklich freigegeben wurden. Die Originaldatei bleibt unverändert.

## Quellen

- Nutzer-Screenshot und Datei „NYPM - Protokoll.pdf“ vom 09.09.2026.
- [Vercel: Request-Größenlimit und direkter Blob-Upload](https://vercel.com/docs/errors/function_payload_too_large).
- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk); installierte Version 2.6.1.
