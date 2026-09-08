# Shownotes pro Lektion

Jede Video-Lektion kann eine optionale Zusammenfassung enthalten, auch eine Dienstagslektion als Live-Tape-Reading. Mitglieder sehen sie unter dem Player und den Lektionsaktionen. Leere Shownotes bleiben ausgeblendet. Die Darstellung übernimmt Farben und Schriften des Mitgliederbereichs, einschließlich des dunklen Designs.

Admins wählen **Shownotes hinzufügen** oder **Bearbeiten**, fügen Text ein, prüfen die **Vorschau** und speichern ausdrücklich. Unterstützt sind Markdown-Überschriften, Listen, Links, Hervorhebungen und Zitate. HTML und eingebettete Bilder werden nicht ausgeführt oder geladen. Die Grenze liegt bei 30.000 Zeichen. Leerer Text entfernt die Shownotes.

Nicht gespeicherte Entwürfe bleiben bei einem Lektionswechsel oder Neuladen im selben Browser-Tab erhalten, sofern dessen Sitzungsspeicher verfügbar ist. **Abbrechen** verwirft den Entwurf. Fehlgeschlagene Speicherungen behalten ihn. Bei parallelen Änderungen zeigt der Editor die aktuelle Fassung zum Vergleich; erst eine ausdrückliche Auswahl übernimmt diese oder speichert den eigenen Entwurf darüber.

## Erstes Beispiel

[PM-Tape-Reading vom 08.09.2026](examples/lesson-show-notes-2026-09-08.md) ist die bereinigte Wispr-Flow-Vorlage von Petar für seine Dienstagslektion. Leere Listenpunkte und die defekte Nummerierung wurden entfernt; der Text wurde sprachlich geglättet. Die Aufnahme wurde dafür nicht transkribiert oder inhaltlich gegen Audio und Chartbilder geprüft. Die Aussagen bleiben Petars Zusammenfassung dieser Session.

## Produktionsablauf

1. Die vollständige Aufnahme und das fertige Video nach dem bestehenden Schnittstandard behandeln.
2. Petars vorhandene Wispr-Zusammenfassung verwenden oder lokal aus der Aufnahme einen Transkriptentwurf erstellen. Whisper ist ein möglicher lokaler Weg; die Laufzeit einer vollständigen Aufnahme muss gemessen werden.
3. Den Entwurf zu Überblick, besprochenem Kontext, gezeigten Beispielen, Dokumentation und nächsten Schritten verdichten. Keine Trefferquoten, neuen Regeln oder Ergebnisse ergänzen. Unklare Fachbegriffe und Aussagen anhand von Audio und passenden Chartbildern prüfen.
4. Die freigegebene Zusammenfassung als Markdown neben dem Produktionspaket speichern und der konkreten Video-ID zuordnen.
5. Erst im autorisierten Veröffentlichungsschritt speichern und die Mitgliedsansicht erneut öffnen. Eine Transkription oder Zusammenfassung allein genehmigt keinen Upload oder Discord-Post.

Der persönliche Videoproduktions-Skill wird durch diese Implementierung nicht verändert.

## Daten und API

Die additive Migration `20260908200000_add_video_show_notes` ergänzt `Video.showNotes` als optionalen Text. Bestehende Lektionen erhalten `NULL`.

`PATCH /api/videos/:id/show-notes` akzeptiert einen angemeldeten Admin oder das bereits konfigurierte Agent-Upload-Token. Der Endpunkt ändert ausschließlich Shownotes; Video, PDF, Titel und Discord-Ankündigungen bleiben unabhängig davon.

```json
{
  "showNotes": "Kurzer Überblick.\n\n## Themen\n\n- Erster Punkt",
  "expectedShowNotes": null
}
```

`expectedShowNotes` ist die gelesene Ausgangsfassung. Stimmt sie nicht mehr überein, antwortet der Endpunkt mit `409` und der aktuell gespeicherten Fassung. Ohne Ausgangsfassung ist ein bewusstes Überschreiben möglich, beispielsweise durch einen autorisierten Produktionsaufruf. Ein fehlendes Video ergibt `404`; fehlende Berechtigung `401` oder `403`; ungültiger Text `400`.

Vor einer Bereitstellung die Datenbankzuordnung des Deployment-Ziels prüfen: Das bestehende `vercel-build` führt Datenbankmigrationen aus. Die Shownotes-Vorschau speichert ausschließlich in einer separaten Testdatenbank und ist kein Produktionsnachweis.

## Validierung am 08.09.2026

- 72 Tests erfolgreich, einschließlich Berechtigungen, Textvalidierung, konkurrierenden Änderungen und Fehlerantworten. Typprüfung und gezielter ESLint-Lauf erfolgreich.
- Produktionsbuild erfolgreich mit lokalen Testwerten. Der bestehende Vorabruf von Stripe-Kennzahlen war mit dem Platzhalterschlüssel erwartungsgemäß nicht verfügbar; echte Zahlungs- oder Auth-Dienste wurden damit nicht verifiziert.
- Die neue Migration auf einer lokalen PostgreSQL-Datenbank mit dem aktuellen `main`-Schema geprüft: zwei vorhandene Lektionsdatensätze bleiben unverändert, das zusätzliche Feld startet mit `NULL`.
- Der vollständige Aufbau einer leeren Datenbank aus der historischen Migrationsfolge scheitert bereits in `20260521153000_add_mentorship_performance_indexes`, weil dort die Tabelle `Page` fehlt. Dies ist eine bestehende Lücke. Die lesende Prüfung der konfigurierten PAT-Datenbank zeigt alle 15 bisherigen Migrationen als abgeschlossen und das neue Shownotes-Feld noch nicht vorhanden.
- Browserprüfung mit den tatsächlichen Komponenten und der neuen API gegen die lokale Testdatenbank: Speichern und Neuladen, Vorschau, Entwurferhalt bei Fehler und Lektionswechsel sowie Vergleich und Auflösung eines Konflikts aus zwei Tabs erfolgreich. Mitglieder sehen keine Bearbeitungsfunktion, leere Shownotes keinen Bereich.
- PAT-Schriftvererbung geprüft. Bei 320 und 1280 Pixeln kein horizontaler Überlauf; helle und dunkle Mobilansicht, Eingabeschrift mit 16 Pixeln und Bedienelemente mit mindestens 44 Pixeln Höhe geprüft. HTML, eingebettete Bilder und JavaScript-Links werden in der Vorschau nicht ausgeführt oder geladen.

Noch ausstehend: Freigabe und Bereitstellung auf PAT, Zuordnung des Beispiels zur tatsächlichen Dienstagslektion nach deren Anlage sowie Prüfung im angemeldeten Mitgliederbereich. Die heutige Aufnahme wurde in diesem Auftrag nicht bearbeitet oder hochgeladen.
