# PAT Research – isolierte Testumgebung (Vercel-Preview des Research-Branches)

**Ziel:** Bevor der Branch `feat/pat-research-platform` zum ersten Mal gepusht wird, muss nachweislich feststehen, dass sein Preview-Deployment **nichts** mit Production teilt: keine Datenbank, keine Live-Zahlungen, keine echten Nachrichten, keine gemeinsamen Speicher.

Der Push startet automatisch einen Preview-Build. `vercel-build` führt dabei `prisma migrate deploy` gegen die `DATABASE_URL` des Previews aus.

Alle Werte trägst du selbst ein. Claude bekommt keine Secrets zu sehen, und die Skripte geben nur Präfixe und Fingerprints aus.

## Status 25.09.2026 (von Claude per Vercel-CLI erledigt, auf Petars Wunsch)

- **Test-DB angelegt:** `pat-research-test-db` (Prisma Postgres, Region fra1).
  - Über die bestehende Prisma-Installation, daher Tarif Starter für die ganze Installation, bis zu 1.000 DBs inklusive; keine Zusatzkosten bis zum Nutzungskontingent.
  - Nur mit Preview verbunden, Variablen mit Präfix `RESEARCH_TEST_`. Bestehende Variablen wurden nicht überschrieben.
- **Befund:** Die Previews nutzten schon vorher eine eigene DB (`pat-videos-db`, nur Preview/Development), getrennt von `PAT-MentorshipProduction-DB` (nur Production).
- **Branch-Overrides für `feat/pat-research-platform`:**
  - `DATABASE_URL` zeigt auf die neue Test-DB.
  - `DISCORD_BOT_TOKEN`, `DISCORD_MOD_CHANNEL_ID`, `BREVO_API_KEY`, `GITHUB_BLOG_TOKEN`, `BLOB_READ_WRITE_TOKEN` und `BUNNY_API_KEY` stehen auf `disabled`.
- **Bootstrap der Test-DB:** ausgeführt (Baseline `origin/main` plus Research-Migration).
- **Isolationsnachweis** (`scripts/research-verify-test-env.mjs`): „Research-Testumgebung ist isoliert.“ Die Production-DB wurde über `PROD_DATABASE_URL` verglichen; Production-`DATABASE_URL` ist in Vercel „Sensitive“ und nicht lesbar.
- **Noch offen, nur für Kauftests:** Stripe-Test-Objekte und Test-Webhook, erledigt mit **einem Befehl** (Abschnitt 3).
- **Vercel-Einstellungen:** Previews sind ohne Vercel-Login erreichbar (keine Deployment Protection), und `VERCEL_ENV` wird bereitgestellt.
- **Prisma-Tarif:** Beim Anlegen der Test-DB hat `--plan free` die Umstellung der **ganzen** Installation auf Free (ab 1. Oktober) vorgemerkt. Der Tarif gilt pro Installation, nicht pro DB. Auf Petars Wunsch per `vercel integration update prisma --plan starter` zurückgenommen; alle drei DBs laufen weiter im Starter-Tarif. Merke: bei `vercel integration add prisma/prisma-postgres` **nie** `--plan` angeben.

## 1. Eigene Test-Datenbank (✓ erledigt, Referenz)

1. Lege eine **neue, leere** Postgres-Datenbank an, z. B. „pat-research-test“: Vercel → Storage → Prisma Postgres → Create, oder in der Prisma-Konsole.
   - Verwende die **direkte** Postgres-URL (`postgres://…@db.prisma.io:5432/…`), keine Accelerate-URL (`prisma+postgres://…`). Nur bei der direkten URL kann das Prüfskript die Datenbank eindeutig von Production unterscheiden, und auch das Bootstrap-Skript braucht sie.
   - Sie nicht mit einer Umgebung des Projekts verbinden. Sonst würde sie die bestehende Preview-DB aller Branches ersetzen.
   - Nur die Connection-URL kopieren.
2. Vercel → Project → Settings → Environment Variables → **Add**:
   - Key: `DATABASE_URL`, Value: die neue URL
   - Environment: **nur Preview**
   - Branch: `feat/pat-research-platform`
3. **Bootstrap** in deinem Terminal, im Worktree:
   ```bash
   vercel env pull .env.research-preview --environment=preview --git-branch=feat/pat-research-platform
   vercel env pull .env.research-production --environment=production
   node scripts/research-bootstrap-test-db.mjs --target-env-file .env.research-preview --production-env-file .env.research-production
   node scripts/research-bootstrap-test-db.mjs --target-env-file .env.research-preview --production-env-file .env.research-production --apply
   ```
   - Warum das nötig ist: Die bestehende Migrationshistorie lässt sich nicht auf einer leeren DB abspielen, weil die Tabelle `Page` nie per Migration angelegt wurde.
   - Was das Skript macht: Es spielt das Schema von `origin/main` ein, markiert dessen 16 Migrationen als angewendet und wendet dann nur die neuen Research-Migrationen an.
   - Es bricht ab, wenn die Ziel-DB die Production-DB ist oder nicht leer ist.

## 2. Branch-Overrides (Environment: Preview, Branch: `feat/pat-research-platform`)

**Stand laut `vercel env ls preview` (25.09.2026, nur Namen gelesen):**
- **Teilen sich Preview und Production** (ein Eintrag für beide, also derselbe Wert): `BLOB_READ_WRITE_TOKEN`, `BREVO_API_KEY`, `BREVO_LIST_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`/`_SECRET`, `DISCORD_GUILD_ID`, `GITHUB_BLOG_TOKEN`, `WHOP_*`, `PAYPAL_WEBHOOK_ID`.
- **Nur Preview:** `DATABASE_URL` (plus `POSTGRES_URL`, `PRISMA_DATABASE_URL`; die nutzt der Code nicht), `STRIPE_SECRET_KEY`, Clerk-Keys, `BUNNY_*`, `DISCORD_MOD_CHANNEL_ID`.
- **`STRIPE_WEBHOOK_SECRET`** gibt es nur für den Branch `dev`.
- **Im Preview gar nicht gesetzt:** `TELEGRAM_BOT_TOKEN`, `DISCORD_MENTORSHIP_*`, `AGENT_UPLOAD_TOKEN`, `HERMES_UPLOAD_TOKEN`, `BLOB_PRIVATE_READ_WRITE_TOKEN`.

**Overrides für den Research-Branch:**

| Variable | Wert | Wer |
|----------|------|-----|
| `DATABASE_URL` | direkte URL der neuen Test-DB (Abschnitt 1) | ✓ erledigt (Claude) |
| `STRIPE_WEBHOOK_SECRET` | Secret des neuen Test-Webhooks (Abschnitt 3) | Setup-Skript mit deinem Testkey; wird nie angezeigt |
| `DISCORD_BOT_TOKEN`, `DISCORD_MOD_CHANNEL_ID`, `BREVO_API_KEY`, `GITHUB_BLOG_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `BUNNY_API_KEY` | `disabled` | ✓ erledigt (Claude) |
| `STRIPE_RESEARCH_PRODUCT_ID_READER/_MEMBER/_SUPPORTER`, `STRIPE_PRICE_ID_RESEARCH_*` (6×), `STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY/_ANNUAL/_BASIC` | schreibt `scripts/research-stripe-setup.mjs` (Abschnitt 3) | Setup-Skript mit deinem Testkey |

`STRIPE_SECRET_KEY` und die Clerk-Keys bleiben wie im Preview: Testkey und Testinstanz.

Vercel nimmt keine leeren Werte an. Ein Override mit `disabled` gilt für das Prüfskript als „leer“: Die Dienste lehnen den Wert ab, es entstehen keine Nachrichten, Uploads oder Commits. Blob-Uploads schlagen im Research-Preview dann fehl; ein eigener Test-Blob-Store folgt in Phase b.

## 3. Stripe-Testmodus (ein Befehl)

Voraussetzung: Die Vercel-CLI ist angemeldet (`npx vercel@latest login`; auf deinem Mac bereits `petar-23`).

Zuerst ohne `--apply` als Trockenlauf, danach mit `--apply`:

```bash
STRIPE_SECRET_KEY=sk_test_… node scripts/research-stripe-setup.mjs --apply \
  --webhook-url https://pat-mentorship-25-webpage-git-feat-pat-7e635c-petar23s-projects.vercel.app/api/webhooks/stripe \
  --vercel-branch feat/pat-research-platform \
  --terms-url https://pat-mentorship-25-webpage-git-feat-pat-7e635c-petar23s-projects.vercel.app/research/terms \
  --privacy-url https://www.price-action-trader.de/datenschutz
```

Was der Befehl tut:
- **Schutz:** Er verweigert Live-Keys und schreibt nie in `main`, `dev` oder den Production-Branch.
- **Produkte und Portal:** drei Produkte „PAT Research Reader/Member/Supporter“ mit je Monats- und Jahrespreis (USD, inklusive Steuer) sowie drei Portal-Konfigurationen (monatlich, jährlich, basic).
  - Drei Produkte statt einem, weil Stripe im Kundenportal pro Produkt nur einen Preis je Intervall erlaubt.
  - Monat ↔ Jahr ist im Portal bewusst gesperrt, weil Stripe sonst sofort ohne Gutschrift abbucht.
- **Test-Webhook:** ein eigener Endpoint für die stabile Branch-URL.
  - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`
  - API-Version: `2024-10-28.acacia`
  - Das Signing-Secret wird **nie angezeigt**, sondern direkt als `STRIPE_WEBHOOK_SECRET` (Sensitive) nur für diesen Branch in Vercel eingetragen.
  - Hinweis: Der Endpoint erhält alle Testmodus-Events des Kontos, auch Mentorship-Tests. Deshalb sind Discord und Co. im Branch auf `disabled`, und die DB ist getrennt.
- **IDs:** Die 12 IDs (Produkte, Preise, Portal) landen als Branch-Variablen in Vercel.
- **Wiederholen ist sicher:** Vorhandenes wird erkannt. Ein neues Webhook-Secret gibt es nur mit `--rotate-webhook`.

Danach einmal neu deployen, damit das Preview die neuen Variablen lädt; das übernimmt Claude.

## 4. Isolation nachweisen

```bash
vercel env pull .env.research-preview --environment=preview --git-branch=feat/pat-research-platform
vercel env pull .env.research-production --environment=production
node scripts/research-verify-test-env.mjs --preview-env-file .env.research-preview --production-env-file .env.research-production
rm .env.research-preview .env.research-production
```

Erst wenn am Ende „Ergebnis: Research-Testumgebung ist isoliert.“ steht, darf gepusht werden. Die Ausgabe (PASS/FAIL-Liste ohne Secrets) kannst du mir in den Chat kopieren.

## 5. Nach dem ersten Preview-Deployment

- Research läuft im Preview im **Pfad-Modus**: `https://<preview-url>/research`.
  - Dafür muss Vercel `VERCEL_ENV` zur Laufzeit bereitstellen (Standard: „Automatically expose System Environment Variables“).
  - Falls `/research` im Preview 404 liefert, zusätzlich `RESEARCH_ALLOW_PATH_MODE=1` als Branch-Override setzen.
- `RESEARCH_PUBLIC_HOST` bleibt im Preview **ungesetzt**. In Production bleibt Research ohne diese Variable komplett aus (Kill-Switch).
- Anmeldung mit einem Test-Konto der Clerk-Testinstanz. Stripe-Testkarten:
  - `4242 4242 4242 4242` (Erfolg)
  - `4000 0027 6000 3184` (3-D Secure)
  - `4000 0000 0000 0341` (Karte wird gespeichert, spätere Abbuchung scheitert → `past_due`)

## 6. Vor dem Go-live (nicht Teil der Testumgebung)

- [PR #161](https://github.com/Petar-23/PAT-Mentorship-25-Webpage/pull/161) muss auf `main` sein. Nur er verhindert, dass die Mentorship-E-Mail-Suche den USD-Research-Customer aufgreift. Der Research-Branch enthält ihn bereits.
- Production-Migration, Live-Stripe-Objekte, DNS und `RESEARCH_PUBLIC_HOST` sind eine eigene Freigabe.
