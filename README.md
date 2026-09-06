# Price Action Trader

PAT-Website, Mentorship-Mitgliederbereich und Verwaltung mit Next.js App Router, React, Clerk, Prisma und Stripe.

## Lokal arbeiten

`npm run dev` startet die App. Datenbank, Authentifizierung und Zahlungsdienste verwenden die lokal konfigurierten Umgebungsvariablen.

Die Mentorship-Gestaltung und ihre private Vorschau sind in [MENTORSHIP_DESIGN.md](docs/MENTORSHIP_DESIGN.md) beschrieben. Die Vorschau verwendet echte UI-Komponenten mit einem ausschließlich gelesenen Kurskatalog und lokalem Fortschritt. Der PR enthält den anpassbaren OFL-Entwurf PAT Sans und PAT Serif. Herkunft und Änderungen stehen in [MENTORSHIP_FONTS.md](docs/MENTORSHIP_FONTS.md); die privaten Vergleichsschriften gehören nicht zum Produktionsrepository. Die freigegebenen Cover für 21 bestehende Module sind in `lib/mentorship-module-artwork.ts` zugeordnet. Weitere Module verwenden ihr gespeichertes Kursbild oder ein Standardmotiv.

## Änderungen prüfen

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run measure:mentorship
```

- `typecheck` führt TypeScript ohne Ausgabe aus.
- `test` bündelt die Node-Tests für Lernfortsetzung und Fortschritt, Veröffentlichungsbereitschaft, Discord-Zielprüfung, Idempotenz und Uploads. Der Upload-Test benötigt einen temporären lokalen HTTP-Port.
- `build` prüft den Produktions-Build einschließlich TypeScript. Ein frischer Build lädt die bestehende Sora-Schrift von Google Fonts. Mit Platzhalterzugängen kann er abschließen, obwohl datenabhängige Vorschauen fehlen; das belegt keine funktionsfähige Dienstanbindung.
- `measure:mentorship` liest den letzten Produktions-Build und gibt die pro Mentorship-Route referenzierten JavaScript-Dateien als Byte- und gzip-Summen aus. Für einen Vergleich müssen beide Stände mit denselben Abhängigkeiten gebaut sein. Das misst Dateigrößen, keine Ladezeiten.

Für UI-Änderungen zusätzlich die tatsächlichen Abläufe in beiden Darstellungen prüfen: Navigation, Suche und Rücksetzen, Abschluss und Fehler beim Speichern, Unterlagen, nächste Lektion sowie Tastaturfokus. Aktueller Prüfstand: [PR-Verifikation vom 6. September 2026](docs/MENTORSHIP_PR_VERIFICATION_2026-09-06.md).

## Auslieferung und Inhalte

`vercel-build` führt zusätzlich zur Prisma-Generierung die Datenbankmigrationen aus. Es ist kein Ersatz für den lokalen Build-Check.

- [Mitgliedervideos veröffentlichen](docs/MENTORSHIP_PUBLICATION.md)
- [Mentorship-Bildmotive](docs/MENTORSHIP_ARTWORK.md)
- [Raid-Map-Startcheck](docs/RAIDMAP_LAUNCH_CHECKLIST.md)
