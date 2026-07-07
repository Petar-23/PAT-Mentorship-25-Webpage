# PAT Raid Map — Launch-Checkliste (Stand 2026-07-07)

Alles Automatisierbare ist erledigt: Indikator final (Holdout PASS, BETA entfernt),
Sales-Pages EN/DE + Docs + Account-Bereich + Fulfillment-Automation auf
`feat/raid-map-landing` (PR #127), Deck + X-Artikel fertig. Diese Liste enthält NUR
noch die Schritte, die du selbst machen musst — in dieser Reihenfolge.

## A. TradingView (zuerst — ohne pineId kein Fulfillment)

- [ ] **A1. Pine pasten & kompilieren:** `trading-bot-workspace/pinescript/PAT_RaidMap.pine`
      komplett in den Pine-Editor pasten, kompilieren, auf NQ 1m sichten.
      (Titel ist jetzt "PAT Raid Map" — ohne [BETA].)
- [ ] **A2. Als Invite-only publishen:** Publish Script → Privacy "Invite-only".
      Titel: "PAT Raid Map". (Publikations-Beschreibung: sag Bescheid, ich schreibe
      sie dir TradingView-regelkonform aus dem Claims-Inventar.)
- [ ] **A3. pineId kopieren:** aus der Publish-URL (Format `PUB;xxxxxxxx...`).
- [ ] **A4. Indicator-Eintrag anlegen:** im Admin-Panel /mentorship/indicators —
      Name "PAT Raid Map" (Slug wird automatisch `pat-raid-map`), pineId, ready +
      visible. Fallback ohne UI: `node scripts/create-raidmap-indicator.mjs "PUB;..."`.
- [ ] **A5. TradingView-Session-Cookie prüfen:** der bestehende Claims-Cron
      (`/api/cron/tradingview-claims`) braucht einen gültigen Cookie (gleiche
      Infrastruktur wie im Mentorship-Bereich).

## B. Stripe

- [ ] **B1. Produkt anlegen:** "PAT Raid Map" mit ZWEI wiederkehrenden USD-Preisen:
      $45/Monat (monthly) und $348/Jahr (annual = $29/Monat). Streichpreise
      (54/35) NICHT in Stripe anlegen — die kommen erst nach der Erhöhung.
- [ ] **B2. Env-Vars setzen** (lokal in `.env.local` UND in Vercel, Production +
      Preview): `STRIPE_PRICE_ID_RAIDMAP_MONTHLY`, `STRIPE_PRICE_ID_RAIDMAP_ANNUAL`.
- [ ] **B3. /env-check aufrufen** — beide Variablen müssen grün sein.
- [ ] **B4. Test-Kauf im Stripe-Test-Mode:** einmal komplett durchklicken
      (Trial startet, Webhook feuert, TV-Username landet im Account-Bereich,
      Claim wird angelegt). Der UI-Flow ohne Stripe geht schon lokal via
      `RAIDMAP_TEST_MODE=1` (siehe `docs/RAIDMAP_STRIPE_SETUP.md`, "Test mode").

## C. Webpage / Content

- [ ] **C1. Screenshot ablegen:** dein TradingView-"Invite-only"-Screenshot nach
      `public/images/raidmap/find-invite-only.png` (wird in Success-Popup und
      Account-Bereich angezeigt; Seiten funktionieren auch ohne, zeigen dann nur
      keine Grafik).
- [ ] **C2. AGB ergänzen:** Abschnitt für das Indikator-Abo (Abo-Modell, Trial,
      Invite-only-Zugang, Kündigung über Billing-Portal).
- [ ] **C3. PR #127 mergen** → Vercel-Production-Deploy.
- [ ] **C4. Live-Smoke-Test:** /raid-map, /raid-map/de, /raid-map/docs laden;
      ein echter Kauf mit 7-Tage-Trial inkl. TradingView-Freischaltung.

## D. Go-to-Market

- [ ] **D1. YT-Video:** Deck `trading-bot-workspace/outputs/gtm/PAT_RaidMap_GTM_Deck_CC_EN.pptx`
      (16 Slides, CC-Template, Holdout-Story integriert).
- [ ] **D2. X-Artikel posten:** `trading-bot-workspace/outputs/gtm/x_article_raidmap_EN.md`
      (ICT-Zitate, OOS-Ergebnis eingebaut, Link auf /raid-map).
- [ ] **D3. Weekly-Livestreams** mit der Map auf dem Chart ankündigen (Landing
      verspricht sie).

## Governance-Erinnerungen

- Zahlen NUR aus `trading-bot-workspace/docs/PAT_RAIDMAP_CLAIMS_INVENTORY_20260706.md`
  (Sektion 6 = erlaubte Out-of-Sample-Formulierungen; "2–3×"-Terminus-Claim ist
  gestrichen, neu "~2×" mit konservativem OOS-Wert).
- Der Holdout (Jul 2025 – Jun 2026) ist EINMALIG getestet und dauerhaft gebrannt —
  es gibt keinen zweiten Schuss, und genau so verkaufen wir ihn.
- Launch-Offer: erste 300 Plätze, danach +20% — Zählung/Umstellung ist aktuell
  manuell (Stripe-Preise tauschen + `raidmap-config.ts` anpassen).
