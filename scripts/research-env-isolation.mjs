// Prüflogik für die isolierte PAT-Research-Testumgebung (Vercel-Preview des
// Research-Branches). Vergleicht Werte NUR über Fingerprints (SHA-256-Präfix)
// und gibt niemals Secret-Werte aus. Wird von
// scripts/research-verify-test-env.mjs genutzt und per node:test geprüft.

import { createHash } from 'node:crypto'

/** @param {string} content */
export function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const env = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[match[1]] = value.replace(/\\n/g, '\n')
  }
  return env
}

/** @param {string | undefined} value */
export function fingerprint(value) {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

// Als "Sensitive" gespeicherte Vercel-Variablen liefert `vercel env pull` nur
// als Platzhalter ("[SENSITIVE]") aus. Sie gelten als gesetzt, aber unlesbar.
/** @param {string | undefined} value */
export function isSensitivePlaceholder(value) {
  return typeof value === 'string' && /^\[SENSITIVE/i.test(value.trim())
}

/** @param {string | undefined} value */
function isSet(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/** @param {string | undefined} value */
function isReadable(value) {
  return isSet(value) && !isSensitivePlaceholder(value)
}

/**
 * URL der Production-Datenbank. DATABASE_URL ist in Production meist
 * "Sensitive" (unlesbar); dann dient die Integrations-Variable PROD_DATABASE_URL
 * (Prisma-Postgres-Store, nur mit Production verbunden) als Referenz.
 * @param {Record<string, string | undefined>} production
 * @returns {{ url: string | null, source: string | null }}
 */
export function productionDatabaseUrl(production) {
  if (isReadable(production.DATABASE_URL)) return { url: /** @type {string} */ (production.DATABASE_URL), source: 'DATABASE_URL' }
  if (isReadable(production.PROD_DATABASE_URL)) return { url: /** @type {string} */ (production.PROD_DATABASE_URL), source: 'PROD_DATABASE_URL' }
  return { url: null, source: null }
}

// Vercel nimmt keine leeren Werte an. Ein Branch-Override mit dem Wert
// "disabled" gilt deshalb als "leer" (der Dienst lehnt den Wert ab, es gibt
// keine Seiteneffekte).
export const DISABLED_SENTINEL = 'disabled'

/** @param {string | undefined} value */
function isEnabled(value) {
  return isSet(value) && /** @type {string} */ (value).trim().toLowerCase() !== DISABLED_SENTINEL
}

// Prisma Postgres: direkter und gepoolter Host zeigen auf dieselben Datenbanken.
// Die Datenbank (der Tenant) steckt dort im Benutzernamen, nicht im Pfad — alle
// Tenants heißen z. B. "postgres". Deshalb Identität = Host + Fingerprint des Tenants.
const PRISMA_POSTGRES_HOSTS = new Map([
  ['db.prisma.io', 'db.prisma.io'],
  ['pooled.db.prisma.io', 'db.prisma.io'],
])

/**
 * Datenbank-Identität ohne Zugangsdaten. Allgemein Host, Port und Datenbankname;
 * bei Prisma Postgres Host + Fingerprint des Tenants (Benutzername). Accelerate-
 * URLs (prisma+postgres://…?api_key=…) lassen keinen Rückschluss auf die DB zu
 * und liefern 'unverifiable'.
 * @param {string | undefined} url
 */
export function databaseIdentity(url) {
  if (!isSet(url)) return null
  try {
    const parsed = new URL(/** @type {string} */ (url))
    if (parsed.protocol === 'prisma+postgres:') return 'unverifiable'
    const host = parsed.hostname.toLowerCase()
    const prismaHost = PRISMA_POSTGRES_HOSTS.get(host)
    if (prismaHost) {
      const tenant = decodeURIComponent(parsed.username)
      return tenant ? `${prismaHost}/tenant:${fingerprint(tenant)}` : 'unverifiable'
    }
    const database = parsed.pathname.replace(/^\//, '') || '(default)'
    return `${host}:${parsed.port || '5432'}/${database}`
  } catch {
    return 'unparseable'
  }
}

/** @param {string | null} identity */
function isComparableIdentity(identity) {
  return Boolean(identity) && identity !== 'unparseable' && identity !== 'unverifiable'
}

// Seiteneffekt-Zugänge, die im Research-Preview leer sein müssen (Branch-
// Override auf leer), damit Tests keine echten Nachrichten, Uploads oder
// Grants auslösen.
export const MUST_BE_EMPTY = Object.freeze([
  'DISCORD_BOT_TOKEN',
  'DISCORD_MOD_CHANNEL_ID',
  'DISCORD_MENTORSHIP_GUILD_ID',
  'DISCORD_MENTORSHIP_CHANNEL_ID',
  'TELEGRAM_BOT_TOKEN',
  'BREVO_API_KEY',
  'GITHUB_BLOG_TOKEN',
  'AGENT_UPLOAD_TOKEN',
  'HERMES_UPLOAD_TOKEN',
])

// Werte, die sich von Production unterscheiden MÜSSEN, falls gesetzt.
export const MUST_DIFFER_FROM_PRODUCTION = Object.freeze([
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CLERK_SECRET_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB_PRIVATE_READ_WRITE_TOKEN',
  'BUNNY_API_KEY',
  'PAYPAL_CLIENT_SECRET',
])

/**
 * @param {{ preview: Record<string, string | undefined>, production: Record<string, string | undefined> | null }} input
 * @returns {{ ok: boolean, checks: Array<{ name: string, ok: boolean, detail: string }>, readiness: Array<{ name: string, ok: boolean, detail: string }> }}
 */
export function evaluateResearchTestIsolation({ preview, production }) {
  /** @type {Array<{ name: string, ok: boolean, detail: string }>} */
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })

  add('DATABASE_URL gesetzt', isSet(preview.DATABASE_URL), isSet(preview.DATABASE_URL) ? `Ziel ${databaseIdentity(preview.DATABASE_URL)}` : 'fehlt')
  const previewDirect = preview.DIRECT_URL ?? preview.MIGRATION_DATABASE_URL
  if (isSet(previewDirect) && isSet(preview.DATABASE_URL)) {
    const sameTarget = databaseIdentity(previewDirect) === databaseIdentity(preview.DATABASE_URL)
    add('DIRECT_URL zeigt auf dieselbe Test-DB', sameTarget, sameTarget ? 'ja' : `Abweichung: ${databaseIdentity(previewDirect)}`)
  }

  if (!production) {
    add('Production-Vergleich', false, 'Production-Env-Datei fehlt (--production-env-file); ohne Vergleich ist die Isolation nicht nachgewiesen')
  } else {
    const previewDb = isReadable(preview.DATABASE_URL) ? databaseIdentity(preview.DATABASE_URL) : null
    const productionRef = productionDatabaseUrl(production)
    const productionDb = databaseIdentity(productionRef.url ?? undefined)
    const comparable = isComparableIdentity(previewDb) && isComparableIdentity(productionDb)
    add(
      'Datenbank ≠ Production',
      comparable && previewDb !== productionDb,
      comparable
        ? `Preview ${previewDb} · Production ${productionDb} (aus ${productionRef.source})`
        : `nicht vergleichbar (Preview ${previewDb ?? 'unlesbar/fehlt'} · Production ${productionDb ?? 'unlesbar/fehlt'}); lesbare, direkte Postgres-URLs verwenden`,
    )
    for (const name of MUST_DIFFER_FROM_PRODUCTION) {
      if (name === 'DATABASE_URL') continue
      if (!isEnabled(preview[name])) {
        add(`${name} ≠ Production`, true, isSet(preview[name]) ? 'disabled' : 'im Preview nicht gesetzt')
        continue
      }
      if (isSensitivePlaceholder(preview[name])) {
        // Das Webhook-Secret legt scripts/research-stripe-setup.mjs als Sensitive an.
        // Es gehört zu einem Testmodus-Endpoint (Stripe-Testkey im Preview) und kann
        // deshalb nie das Secret des Live-Endpoints von Production sein.
        const testEndpoint = name === 'STRIPE_WEBHOOK_SECRET' && /^(sk|rk)_test_/.test(preview.STRIPE_SECRET_KEY ?? '')
        add(
          `${name} ≠ Production`,
          testEndpoint,
          testEndpoint ? 'Sensitive; Secret eines Testmodus-Endpoints (Preview nutzt einen Stripe-Testkey)' : 'im Preview als Sensitive gespeichert – nicht prüfbar'
        )
        continue
      }
      if (isSensitivePlaceholder(production[name])) {
        // Unlesbar in Production: Unterschied nur über die Test-/Live-Prüfung belegbar.
        const provenTest = (name === 'STRIPE_SECRET_KEY' && /^(sk|rk)_test_/.test(preview[name] ?? ''))
          || (name === 'CLERK_SECRET_KEY' && /^sk_test_/.test(preview[name] ?? ''))
        add(`${name} ≠ Production`, provenTest, provenTest ? 'Production ist Sensitive; Preview ist ein Test-Key' : 'Production ist Sensitive – nicht prüfbar')
        continue
      }
      const same = isSet(production[name]) && fingerprint(preview[name]) === fingerprint(production[name])
      add(`${name} ≠ Production`, !same, same ? 'IDENTISCH mit Production' : `Fingerprint ${fingerprint(preview[name])}`)
    }
  }

  const stripeKey = preview.STRIPE_SECRET_KEY ?? ''
  add('Stripe-Testkey', /^(sk|rk)_test_/.test(stripeKey), stripeKey ? `Präfix ${stripeKey.slice(0, 8)}…` : 'fehlt')
  const clerkPublishable = preview.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  add('Clerk-Testinstanz', clerkPublishable.startsWith('pk_test_'), clerkPublishable ? `Präfix ${clerkPublishable.slice(0, 8)}…` : 'fehlt')

  for (const name of MUST_BE_EMPTY) {
    add(
      `${name} leer`,
      !isEnabled(preview[name]),
      isEnabled(preview[name]) ? 'GESETZT – im Research-Preview auf "disabled" überschreiben' : isSet(preview[name]) ? 'disabled' : 'leer'
    )
  }

  add('RESEARCH_TEST_MODE aus', preview.RESEARCH_TEST_MODE !== '1', preview.RESEARCH_TEST_MODE === '1' ? 'gesetzt (wirkt in Previews ohnehin nicht)' : 'aus')

  // Bereitschaft für Kauf-/Webhook-Tests (keine Isolationsfrage: ohne Secret
  // lehnt /api/webhooks/stripe jede Anfrage ab).
  /** @type {Array<{ name: string, ok: boolean, detail: string }>} */
  const readiness = [
    {
      name: 'STRIPE_WEBHOOK_SECRET gesetzt',
      ok: isEnabled(preview.STRIPE_WEBHOOK_SECRET),
      detail: isEnabled(preview.STRIPE_WEBHOOK_SECRET) ? 'gesetzt' : 'fehlt – eigener Stripe-Test-Webhook für den Branch nötig',
    },
    {
      name: 'Research-Stripe-IDs gesetzt',
      ok: RESEARCH_STRIPE_ID_ENV_NAMES.every((name) => isEnabled(preview[name])),
      detail: `${RESEARCH_STRIPE_ID_ENV_NAMES.filter((name) => isEnabled(preview[name])).length}/${RESEARCH_STRIPE_ID_ENV_NAMES.length} (scripts/research-stripe-setup.mjs)`,
    },
  ]

  return { ok: checks.every(check => check.ok), checks, readiness }
}

export const RESEARCH_STRIPE_ID_ENV_NAMES = Object.freeze([
  'STRIPE_RESEARCH_PRODUCT_ID_READER',
  'STRIPE_RESEARCH_PRODUCT_ID_MEMBER',
  'STRIPE_RESEARCH_PRODUCT_ID_SUPPORTER',
  'STRIPE_PRICE_ID_RESEARCH_READER_MONTHLY',
  'STRIPE_PRICE_ID_RESEARCH_READER_ANNUAL',
  'STRIPE_PRICE_ID_RESEARCH_MEMBER_MONTHLY',
  'STRIPE_PRICE_ID_RESEARCH_MEMBER_ANNUAL',
  'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_MONTHLY',
  'STRIPE_PRICE_ID_RESEARCH_SUPPORTER_ANNUAL',
  'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_MONTHLY',
  'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_ANNUAL',
  'STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID_BASIC',
])
