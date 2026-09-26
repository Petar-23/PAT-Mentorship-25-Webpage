#!/usr/bin/env node
// Weist nach, dass die Vercel-Preview-Umgebung des Research-Branches von
// Production isoliert ist — ohne einen einzigen Secret-Wert auszugeben.
//
// Ablauf (Petar, im eigenen Terminal, Dateien bleiben lokal und gitignored):
//   vercel env pull .env.research-preview --environment=preview --git-branch=feat/pat-research-platform
//   vercel env pull .env.research-production --environment=production
//   node scripts/research-verify-test-env.mjs --preview-env-file .env.research-preview --production-env-file .env.research-production
//   rm .env.research-preview .env.research-production
//
// Ausgabe: PASS/FAIL je Prüfung, nur Fingerprints/Präfixe, Exit-Code 1 bei FAIL.

import fs from 'node:fs'
import { evaluateResearchTestIsolation, parseEnvFile } from './research-env-isolation.mjs'

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const previewFile = argValue('--preview-env-file')
const productionFile = argValue('--production-env-file')

if (!previewFile) {
  console.error('Usage: node scripts/research-verify-test-env.mjs --preview-env-file <file> --production-env-file <file>')
  process.exit(2)
}

const preview = parseEnvFile(fs.readFileSync(previewFile, 'utf8'))
const production = productionFile ? parseEnvFile(fs.readFileSync(productionFile, 'utf8')) : null
const result = evaluateResearchTestIsolation({ preview, production })

console.log('Isolation von Production:')
for (const check of result.checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name} — ${check.detail}`)
}
console.log('\nBereit für Kauf-/Webhook-Tests (keine Isolationsfrage):')
for (const item of result.readiness) {
  console.log(`${item.ok ? 'OK  ' : 'OFFEN'}  ${item.name} — ${item.detail}`)
}
console.log(result.ok ? '\nErgebnis: Research-Testumgebung ist isoliert.' : '\nErgebnis: NICHT isoliert — bitte die FAIL-Punkte beheben, vorher nicht deployen.')
process.exit(result.ok ? 0 : 1)
