# PAT Raid Map — Stripe & Fulfillment Setup (TODO-Liste für Petar)

Stand: 2026-07-06. Die Website ist fertig vorbereitet — es fehlen nur die
Stripe-Objekte und zwei Env-Vars. Danach ist der Checkout live.

## 1. In Stripe anlegen (Dashboard → Produktkatalog)

1. Produkt: **"PAT Raid Map"** (ohne BETA — Holdout-PASS 07.07.) (Beschreibung z. B. "TradingView indicator —
   session bias & run timing for NQ. Invite-only access.")
2. Zwei wiederkehrende Preise in **USD**:
   - Monthly: **$45.00 / month**
   - Annual: **$348.00 / year**
   (Kein Trial am Price konfigurieren — die 7 Trial-Tage setzt der Code in der
   Checkout-Session via `trial_period_days: 7`.)
3. Beide Price-IDs kopieren (beginnen mit `price_`).
4. NACH den ersten 300 Mitgliedern (+20%): zwei NEUE Prices anlegen ($54/mo,
   $420/yr — 35/mo) und nur die Env-Vars umstellen. Bestehende Abos bleiben in
   Stripe automatisch auf ihrem alten Preis (Grandfathering wie beworben).

## 2. Env-Vars setzen (lokal in .env UND in Vercel, Production + Preview)

```
STRIPE_PRICE_ID_RAIDMAP_MONTHLY=price_...
STRIPE_PRICE_ID_RAIDMAP_ANNUAL=price_...
```

Check: /env-check zeigt beide mit ✓.

## 3. Was bereits gebaut ist

- Sales-Pages: `/raid-map` (EN) und `/raid-map/de` (DE), Docs unter
  `/raid-map/docs` (+ `/de`). In sitemap.ts eingetragen, hreflang gesetzt.
- Checkout: `POST /api/raidmap-checkout` (Clerk-Login nötig; ohne Login leitet der
  Button automatisch zu /sign-in mit Rücksprung). Tier kommt aus dem Button
  (monthly/annual). Session: mode=subscription, locale auto, automatic_tax,
  **Custom-Field "TradingView username"** wird im Checkout abgefragt.
- Subscription-Metadata: `product=raidmap`, `tier=...`, `userId` — der bestehende
  Webhook cached sie wie gehabt in `UserSubscription.priceIds`.

## 4. Fulfillment (TradingView Invite-Only) — AUTOMATISIERT (Stand 06.07. Abend)

Der komplette Flow ist gebaut und nutzt die bestehende Cookie-/Cron-Infrastruktur:

- **Checkout → Claim:** Der Stripe-Webhook legt bei `product=raidmap` automatisch
  einen `IndicatorClaim` mit dem im Checkout erfassten TradingView-Username an
  (`lib/raidmap-fulfillment.ts`); der stündliche Cron granted wie beim Mentorship.
- **Account-Bereich:** `/raid-map/account` (Login via Clerk) — Abo-Status,
  Billing-Portal (kündigen/Rechnungen), TradingView-Username setzen/ändern mit
  Live-Claim-Status, "Wo finde ich den Indikator"-Guide.
- **Success-Popup:** Nach dem Checkout (`/raid-map?checkout=success`) erklärt ein
  Dialog die Invite-only-Fundstelle (mit Screenshot) und verlinkt den Account-Bereich.

**Deine 2 Handgriffe dafür:**
1. Nach dem TradingView-Publish im Admin-Panel (/mentorship/indicators) einen
   Indicator anlegen mit **Slug exakt `pat-raid-map`**, der `pineId` des
   veröffentlichten Scripts (Format `PUB;...`, steht in der Script-URL bzw. im
   Owner-Import) und `ready` + `visible` aktivieren. Ab dann läuft alles automatisch;
   vorher sammelt der Account-Bereich die Usernames mit freundlichem Hinweis.
2. Deinen Invite-only-Screenshot ablegen als
   `public/images/raidmap/find-invite-only.png` (der aus dem Chat) — Popup und
   Account-Seite blenden ihn dann automatisch ein.

## 4b. Alter Stand (überholt) — manuelles Fulfillment

Die vorhandene Indicator-Claim-Infrastruktur (Prisma `Indicator`/`IndicatorClaim`,
`lib/indicators/*`, Cron `/api/cron/tradingview-claims`) ist ans Mentorship-Abo
gekoppelt. Für Raid-Map-Käufer gibt es zwei Wege:

- **Schnellstart (manuell, Tag 1):** Stripe-Email-Benachrichtigung bei Kauf →
  TradingView-Username steht in der Checkout-Session (custom_fields) → manuell in
  TradingView "Manage access" eintragen. Bei <20 Sales/Woche völlig okay.
- **Automatisierung (Folge-Task):** In `lib/indicators/store.ts` eine Access-Quelle
  "raidmap-subscription" ergänzen: Zugriff, wenn `UserSubscription.priceIds` eine
  der beiden RAIDMAP-Price-IDs enthält und Status active/trialing; den
  TV-Username aus der Checkout-Session (oder Dashboard-Claim-Flow) in
  `IndicatorClaim` schreiben — der bestehende TradingView-Cron erledigt dann den
  Grant. Aufwand ~1 Session; sagen, wenn ich das bauen soll.

## Test mode (dev only)

Zum lokalen Testen des kompletten Raid-Map-User-Flows OHNE Clerk-Login und OHNE
Stripe (`lib/raidmap-test-mode.ts`). Env-Vars (in `.env.local`, gitignored):

```
RAIDMAP_TEST_MODE=1                       # aktiviert den Test-Mode
RAIDMAP_TEST_ACCESS=trialing              # simulierter Abo-Status: active | trialing | none (default: trialing)
RAIDMAP_TEST_TIER=monthly                 # simulierter Plan: monthly | annual (default: monthly)
```

Was simuliert wird:

- `/raid-map/account` ohne Login: statt Redirect zu /sign-in wird der Test-User
  `raidmap_test_user` verwendet; sein Abo-Status kommt aus `RAIDMAP_TEST_ACCESS`/
  `RAIDMAP_TEST_TIER` (keine DB-Abfrage der Subscription).
- `POST /api/raidmap-checkout` gibt sofort
  `{ "url": "/raid-map?checkout=success&test=1" }` zurück — Stripe (und Clerk)
  werden nicht angefasst, das Success-Popup lässt sich so durchklicken.
- Die TV-Username-Claim-Action akzeptiert den Test-User ebenfalls (der Claim
  landet ggf. als normaler DB-Eintrag unter `raidmap_test_user`).

Production ist doppelt geschützt: Der Bypass greift zentral in
`isRaidMapTestMode()` nur wenn `NODE_ENV !== 'production'` UND
`RAIDMAP_TEST_MODE === '1'` — in Production-Builds also nie, selbst wenn die
Env-Var versehentlich gesetzt wäre. Ohne gesetzte Var verhält sich auch Dev
exakt wie vorher.

## 5. Rechtliches (kurz)

- Impressum/AGB/Widerruf existieren (deutsch). Für internationale USD-Verkäufe:
  AGB-Abschnitt für den Indikator ergänzen (digitale Leistung, Zugangsdauer =
  Abolaufzeit) — Anwalt kurz drüberschauen lassen.
- Alle Marketing-Zahlen NUR aus
  `trading-bot-workspace/docs/PAT_RAIDMAP_CLAIMS_INVENTORY_20260706.md`.
