import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8')
const checks = []

function check(name, fn) {
  fn()
  checks.push(name)
}

function versionTuple(value) {
  const normalized = String(value).replace(/^[^0-9]*/, '')
  assert.match(normalized, /^\d+\.\d+\.\d+$/, `Expected stable exact version, got ${value}`)
  return normalized.split('.').map(Number)
}

function assertVersionAtLeast(actual, minimum) {
  const left = versionTuple(actual)
  const right = versionTuple(minimum)
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return
    if (left[index] < right[index]) {
      assert.fail(`Expected ${actual} to be at least ${minimum}`)
    }
  }
}

const packageJson = JSON.parse(read('package.json'))

check('patched stable dependency floors', () => {
  assertVersionAtLeast(packageJson.dependencies.next, '16.2.10')
  assertVersionAtLeast(packageJson.dependencies['@clerk/nextjs'], '6.39.3')
  assertVersionAtLeast(packageJson.dependencies['@vercel/blob'], '2.3.0')
  assertVersionAtLeast(packageJson.dependencies.react, '19.2.4')
  assertVersionAtLeast(packageJson.dependencies['react-dom'], '19.2.4')
  assert.equal(packageJson.dependencies.axios, undefined)
  assertVersionAtLeast(packageJson.devDependencies.postcss, '8.5.10')
  assertVersionAtLeast(packageJson.overrides['@hono/node-server'], '1.19.13')
  assert.equal(packageJson.overrides.postcss, '$postcss')
  assert.equal(packageJson.dependencies['@prisma/client'], packageJson.devDependencies.prisma)
  assert.equal(packageJson.dependencies['@prisma/adapter-pg'], packageJson.devDependencies.prisma)
})

check('build cannot mutate the database schema', () => {
  assert.equal(packageJson.scripts['vercel-build'], 'prisma generate && next build --webpack')
  assert.equal(packageJson.scripts['db:migrate:deploy'], 'node scripts/migrate-deploy.mjs')
  const migrationScript = read('scripts/migrate-deploy.mjs')
  assert.match(migrationScript, /MIGRATION_DATABASE_URL/)
  assert.match(migrationScript, /DIRECT_URL/)
  assert.match(migrationScript, /migrationUrl === runtimeUrl/)
})

check('Next 16 proxy and baseline security headers', () => {
  assert.equal(existsSync(path.join(root, 'proxy.ts')), true)
  assert.equal(existsSync(path.join(root, 'middleware.ts')), false)
  const config = read('next.config.ts')
  for (const expected of [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    "frame-ancestors 'none'",
    "object-src 'none'",
  ]) {
    assert.match(config, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

check('TradingView account resets stay fail closed', () => {
  const actions = read('app/mentorship/indicators/actions.ts')
  assert.match(actions, /ok: result\.ok/)
  assert.match(actions, /message: !result\.ok/)
  assert.match(actions, /result\.error \?\? 'Reset nicht vollständig\.'/)
})

check('Bunny webhook fails closed', () => {
  const route = read('app/api/webhooks/bunny/route.ts')
  assert.match(route, /process\.env\.BUNNY_WEBHOOK_SIGNING_SECRET/)
  assert.match(route, /signing secret is not configured/)
  assert.doesNotMatch(route, /Accepting unsigned webhook/)
  assert.doesNotMatch(route, /BUNNY_STREAM_READ_ONLY_API_KEY|BUNNY_READ_ONLY_API_KEY/)

  for (const providerRoute of [
    'app/api/webhooks/stripe/route.ts',
    'app/api/webhooks/paypal/route.ts',
  ]) {
    assert.doesNotMatch(read(providerRoute), /Webhook error: \$\{/)
  }
})

check('agent upload authentication and limits', () => {
  const auth = read('lib/agent-upload-auth.ts')
  const route = read('app/api/agent/uploads/route.ts')
  assert.match(auth, /MIN_AGENT_TOKEN_LENGTH = 32/)
  assert.doesNotMatch(auth, /HERMES_UPLOAD_TOKEN|x-agent-upload-token/)
  assert.match(route, /DEFAULT_SIGNATURE_EXPIRE_MINUTES = 15/)
  assert.match(route, /MAX_SIGNATURE_EXPIRE_MINUTES = 60/)
  assert.match(route, /MAX_REQUEST_BYTES = 32 \* 1024/)
  assert.match(route, /\.max\(2_000\)/)
})

check('upload token size limits are enforced', () => {
  for (const routePath of [
    'app/api/course-icon-upload/route.ts',
    'app/api/indicator-image-upload/route.ts',
    'app/api/modul-upload/route.ts',
    'app/api/page-icon-upload/route.ts',
    'app/api/page-image-upload/route.ts',
  ]) {
    assert.match(read(routePath), /maximumSizeInBytes/)
  }
})

check('paid PDFs use private storage and entitled streaming', () => {
  const upload = read('app/api/upload/pdf/route.ts')
  const download = read('app/api/download/pdf/[videoId]/[filename]/route.ts')
  const migration = read('scripts/migrate-private-pdfs.mjs')
  assert.match(upload, /access: 'private'/)
  assert.match(upload, /BLOB_PRIVATE_READ_WRITE_TOKEN/)
  assert.doesNotMatch(upload, /access: 'public'/)
  assert.match(download, /getMentorshipAccessState/)
  assert.match(download, /access: 'private'/)
  assert.match(download, /private, no-store/)
  assert.match(migration, /--apply requires --expect-count/)
  assert.match(migration, /delete --apply requires --acknowledge-public-deletion/)
  assert.match(migration, /pdfUrl: record\.originalPdfUrl/)
  assert.match(migration, /Object does not contain a valid PDF header/)
  assert.match(migration, /pg_try_advisory_lock/)
  assert.match(migration, /MIGRATION_DATABASE_URL/)
  assert.match(migration, /direct non-pooled database URL/)
  assert.match(migration, /--apply requires --expect-digest/)
  assert.match(migration, /Manifest context does not match/)
  assert.match(migration, /phase,/)
  assert.match(migration, /selected:/)
  assert.match(migration, /'PREPARED'/)
  assert.match(migration, /'COMMITTED'/)
  assert.match(migration, /'VERIFIED'/)
  assert.match(migration, /'DELETED'/)
  assert.match(migration, /ifMatch: currentSource\.etag/)

  for (const outputPath of [
    'app/mentorship/modul/[id]/page.tsx',
    'app/mentorship/[id]/page.tsx',
    'app/courses/[id]/page.tsx',
    'app/api/chapters/route.ts',
    'app/api/videos/route.ts',
    'app/api/videos/[id]/route.ts',
  ]) {
    assert.match(read(outputPath), /toProtectedPdfUrl/)
  }
})

check('example env is tracked-safe and excludes public Bunny credentials', () => {
  const example = read('.env.example')
  assert.match(read('.gitignore'), /!\.env\.example/)
  assert.doesNotMatch(example, /^NEXT_PUBLIC_BUNNY_API_KEY=/m)
  for (const key of [
    'CLERK_SECRET_KEY',
    'BUNNY_EMBED_TOKEN_KEY',
    'BUNNY_WEBHOOK_SIGNING_SECRET',
    'BLOB_PRIVATE_READ_WRITE_TOKEN',
    'AGENT_UPLOAD_TOKEN',
    'CLERK_ADMIN_ORGANIZATION_ID',
    'MENTORSHIP_ACCESS_OVERRIDE_EMAILS',
  ]) {
    assert.match(example, new RegExp(`^${key}=$`, 'm'))
  }
})

check('content APIs share the complete mentorship entitlement gate', () => {
  for (const routePath of [
    'app/api/pages/route.ts',
    'app/api/pages/[id]/route.ts',
    'app/api/playlists/route.ts',
    'app/api/modules/route.ts',
    'app/api/chapters/route.ts',
    'app/api/videos/route.ts',
    'app/api/videos/duration/[guid]/route.ts',
  ]) {
    const route = read(routePath)
    assert.match(route, /getMentorshipAccessState/)
    assert.match(route, /access\.allowed/)
  }
})

check('admin, claim, and Stripe policies remain fail closed', () => {
  const authz = read('lib/authz.ts')
  assert.match(authz, /CLERK_ADMIN_ORGANIZATION_ID/)

  const migrationRoute = read('app/api/admin/migrate-m25-stripe/route.ts')
  assert.match(migrationRoute, /export async function POST/)
  assert.doesNotMatch(migrationRoute, /export async function GET/)

  const paypalClaim = read('app/api/claim/paypal/route.ts')
  assert.match(paypalClaim, /consumePersistentRateLimit/)
  assert.doesNotMatch(paypalClaim, /new Map/)

  const claimCron = read('app/api/cron/tradingview-claims/route.ts')
  assert.match(claimCron, /rateLimitBucket\.deleteMany/)

  const stripe = read('lib/stripe.ts')
  assert.match(stripe, /requiredPriceIds\.length === 0/)
  assert.match(stripe, /Stripe mentorship access denied/)
})

check('Bunny playback URLs are short-lived, signed, and entitled', () => {
  const player = read('components/video-player.tsx')
  assert.doesNotMatch(player, /iframe\.mediadelivery\.net\/embed/)
  assert.doesNotMatch(player, /NEXT_PUBLIC_BUNNY_LIBRARY_ID/)
  assert.match(player, /\/api\/playback\/video\//)

  for (const routePath of [
    'app/api/playback/video/[videoId]/route.ts',
    'app/api/playback/onboarding/[videoGuid]/route.ts',
  ]) {
    const route = read(routePath)
    assert.match(route, /getMentorshipAccessState/)
    assert.match(route, /access\.allowed/)
    assert.match(route, /private, no-store/)
  }

  const signing = read('lib/bunny-playback.ts')
  assert.match(signing, /BUNNY_EMBED_TOKEN_KEY/)
  assert.match(signing, /createHash\('sha256'\)/)
  assert.match(signing, /MAX_PLAYBACK_TTL_SECONDS = 15 \* 60/)
})

console.log(`Security regression checks passed (${checks.length}):`)
for (const name of checks) console.log(`- ${name}`)
