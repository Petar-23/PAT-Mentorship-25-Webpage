# PAT Raid Map — Stripe & Fulfillment Setup (TODO-Liste für Petar)

Stand: 2026-07-06. Die Website ist fertig vorbereitet — es fehlen nur die
Stripe-Objekte und zwei Env-Vars. Danach ist der Checkout live.

## 1. In Stripe anlegen (Dashboard → Produktkatalog)

1. Produkt: **"PAT Raid Map [BETA]"** (Beschreibung z. B. "TradingView indicator —
   session bias & run timing for NQ. Invite-only access.")
2. Zwei wiederkehrende Preise in **USD**:
   - Monthly: **$45.00 / month**
   - Annual: **$348.00 / year**
3. Beide Price-IDs kopieren (beginnen mit `price_`).

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

## 4. Fulfillment (TradingView Invite-Only) — bewusst noch offen

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

## 5. Rechtliches (kurz)

- Impressum/AGB/Widerruf existieren (deutsch). Für internationale USD-Verkäufe:
  AGB-Abschnitt für den Indikator ergänzen (digitale Leistung, Zugangsdauer =
  Abolaufzeit) — Anwalt kurz drüberschauen lassen.
- Alle Marketing-Zahlen NUR aus
  `trading-bot-workspace/docs/PAT_RAIDMAP_CLAIMS_INVENTORY_20260706.md`.
