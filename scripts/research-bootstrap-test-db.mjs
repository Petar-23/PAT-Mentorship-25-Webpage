#!/usr/bin/env node
// Richtet eine NEUE, LEERE Test-Datenbank für den Research-Preview ein.
//
// Hintergrund: Die Migrationshistorie lässt sich nicht auf einer leeren DB
// abspielen (die Tabelle "Page" wurde nie per Migration angelegt, spätere
// Migrationen referenzieren sie). Deshalb:
//   1. Schema von origin/main (Merge-Base) per `prisma db push` einspielen,
//   2. alle Migrationen dieses Stands als angewendet markieren (Baseline),
//   3. `prisma migrate deploy` spielt danach NUR die neuen Research-
//      Migrationen ein — genau wie später in Production.
//
// Sicherheit:
//   - Ziel-DB kommt aus einer Env-Datei (Wert wird nie ausgegeben).
//   - Pflicht: Production-Env-Datei zum Vergleich; identische DB => Abbruch.
//   - Ziel-DB muss leer sein (keine Tabellen im Schema "public"), sonst Abbruch.
//   - Ohne --apply nur Trockenlauf.
//
// Aufruf (Petar):
//   node scripts/research-bootstrap-test-db.mjs --target-env-file .env.research-preview --production-env-file .env.research-production [--apply]

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import pg from 'pg'
import { databaseIdentity, parseEnvFile } from './research-env-isolation.mjs'

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function fail(message) {
  console.error(`Abbruch: ${message}`)
  process.exit(1)
}

const targetFile = argValue('--target-env-file')
const productionFile = argValue('--production-env-file')
const apply = process.argv.includes('--apply')
const baseRef = argValue('--base-ref') ?? 'origin/main'

if (!targetFile || !productionFile) {
  fail('--target-env-file und --production-env-file sind Pflicht.')
}

const targetUrl = parseEnvFile(fs.readFileSync(targetFile, 'utf8')).DATABASE_URL
const productionUrl = parseEnvFile(fs.readFileSync(productionFile, 'utf8')).DATABASE_URL
if (!targetUrl) fail('DATABASE_URL fehlt in der Ziel-Env-Datei.')
if (!productionUrl) fail('DATABASE_URL fehlt in der Production-Env-Datei (Vergleich nötig).')

const targetIdentity = databaseIdentity(targetUrl)
const productionIdentity = databaseIdentity(productionUrl)
if (!targetIdentity || targetIdentity === 'unparseable') fail('Ziel-DATABASE_URL ist nicht lesbar.')
if (targetIdentity === 'unverifiable' || productionIdentity === 'unverifiable' || productionIdentity === 'unparseable') {
  fail('Datenbank-Identität nicht prüfbar (z. B. Accelerate-URL prisma+postgres://). Bitte die direkten Postgres-URLs verwenden.')
}
if (targetIdentity === productionIdentity || targetUrl === productionUrl) {
  fail(`Ziel-DB ist die Production-DB (${targetIdentity}).`)
}

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const mergeBase = execFileSync('git', ['merge-base', 'HEAD', baseRef], { cwd: repoRoot, encoding: 'utf8' }).trim()
const baselineSchema = execFileSync('git', ['show', `${mergeBase}:prisma/schema.prisma`], { cwd: repoRoot, encoding: 'utf8' })
const baselineMigrations = execFileSync('git', ['ls-tree', '--name-only', `${mergeBase}:prisma/migrations`], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .map(line => line.trim())
  .filter(name => /^\d{8,}/.test(name))

console.log(`Ziel-DB:          ${targetIdentity}`)
console.log(`Production-DB:    ${productionIdentity}`)
console.log(`Baseline:         ${baseRef} @ ${mergeBase.slice(0, 10)} (${baselineMigrations.length} Migrationen)`)

const client = new pg.Client({ connectionString: targetUrl })
await client.connect()
const { rows } = await client.query(
  "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
)
await client.end()
if (rows.length > 0) {
  fail(`Ziel-DB ist nicht leer (${rows.length} Tabellen). Dieses Skript richtet nur leere Test-DBs ein.`)
}
console.log('Ziel-DB ist leer. ✓')

if (!apply) {
  console.log('\nTrockenlauf. Mit --apply werden Schema eingespielt, Baseline markiert und die Research-Migrationen angewendet.')
  process.exit(0)
}

const childEnv = { ...process.env, DATABASE_URL: targetUrl }
const prisma = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma')
const run = (args, label) => {
  const result = spawnSync(prisma, args, { cwd: repoRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  if (result.status !== 0) {
    // Prisma-Ausgaben enthalten keine Passwörter, aber sicherheitshalber gekürzt.
    console.error(`${label} fehlgeschlagen:\n${(result.stderr || result.stdout || '').split('\n').slice(-8).join('\n')}`)
    process.exit(1)
  }
  console.log(`${label} ✓`)
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-baseline-'))
const tempSchema = path.join(tempDir, 'schema.prisma')
fs.writeFileSync(tempSchema, baselineSchema)
try {
  run(['db', 'push', '--schema', tempSchema], '1. Baseline-Schema eingespielt')
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
for (const migration of baselineMigrations) {
  run(['migrate', 'resolve', '--applied', migration], `   als angewendet markiert: ${migration}`)
}
run(['migrate', 'deploy'], '3. Neue Migrationen angewendet')
run(['migrate', 'status'], '4. Migrationsstatus geprüft')
console.log('\nFertig. Der Preview-Build kann jetzt `prisma migrate deploy` gegen diese DB ausführen.')
