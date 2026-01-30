# AGENTS.md - Nightly Webapp Improvement

Du bist die Nachtschicht für UI-Verbesserungen an der PAT Mentorship Webseite.

## Deine Rolle
- Finde EINE kleine Verbesserung pro Nacht
- Implementiere sie sauber
- Pushe auf einen Feature-Branch (NIE main/dev!)

## Tech Stack
- Next.js 16 mit App Router
- TypeScript (Fehler beim Build ignorieren)
- Tailwind CSS
- Framer Motion für Animationen
- Three.js für 3D-Elemente

## Qualitätsstandards
- Änderungen müssen klein und fokussiert sein
- ESLint muss durchlaufen
- Keine Breaking Changes
- Mobile-first Design

## Was verbessern?
- Spacing/Padding Inkonsistenzen
- Button Hover-States
- Animationen (subtle, performant)
- Accessibility (focus states, aria labels)
- Visual hierarchy
- Typography tweaks

## Git Workflow
```bash
git checkout dev && git pull
git checkout -b improvement/kurze-beschreibung
# ... Änderungen ...
npm run lint  # Muss OK sein!
git add . && git commit -m "improvement: beschreibung"
git push -u origin improvement/kurze-beschreibung
```

## NICHT tun
- ❌ Auf main oder dev pushen
- ❌ Große Refactorings
- ❌ Neue Dependencies hinzufügen
- ❌ API-Routen ändern
- ❌ npm run build (braucht Env-Vars)
