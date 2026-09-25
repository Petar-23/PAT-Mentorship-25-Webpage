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

/** @param {string | undefined} value */
function isSet(value) {
  return typeof value === 'string' && value.trim().length > 0
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
 * @returns {{ ok: boolean, checks: Array<{ name: string, ok: boolean, detail: string }> }}
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
    const previewDb = databaseIdentity(preview.DATABASE_URL)
    const productionDb = databaseIdentity(production.DATABASE_URL)
    const comparable = isComparableIdentity(previewDb) && isComparableIdentity(productionDb)
    add(
      'Datenbank ≠ Production',
      comparable && previewDb !== productionDb,
      comparable
        ? `Preview ${previewDb} · Production ${productionDb}`
        : `nicht vergleichbar (Preview ${previewDb ?? '—'} · Production ${productionDb ?? '—'}); direkte Postgres-URLs verwenden, Accelerate-URLs verraten die Datenbank nicht`,
    )
    for (const name of MUST_DIFFER_FROM_PRODUCTION) {
      if (name === 'DATABASE_URL') continue
      if (!isEnabled(preview[name])) {
        add(`${name} ≠ Production`, true, isSet(preview[name]) ? 'disabled' : 'im Preview nicht gesetzt')
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
  add('STRIPE_WEBHOOK_SECRET gesetzt', isSet(preview.STRIPE_WEBHOOK_SECRET), isSet(preview.STRIPE_WEBHOOK_SECRET) ? 'gesetzt' : 'fehlt (eigener Test-Webhook für den Branch)')

  for (const name of MUST_BE_EMPTY) {
    add(
      `${name} leer`,
      !isEnabled(preview[name]),
      isEnabled(preview[name]) ? 'GESETZT – im Research-Preview auf "disabled" überschreiben' : isSet(preview[name]) ? 'disabled' : 'leer'
    )
  }

  add('RESEARCH_TEST_MODE aus', preview.RESEARCH_TEST_MODE !== '1', preview.RESEARCH_TEST_MODE === '1' ? 'gesetzt (wirkt in Previews ohnehin nicht)' : 'aus')

  return { ok: checks.every(check => check.ok), checks }
}
