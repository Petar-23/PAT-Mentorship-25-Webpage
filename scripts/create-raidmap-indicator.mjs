// Fallback ohne Admin-UI: legt den PAT-Raid-Map-Indicator direkt in der DB an (idempotent).
// Nutzung:  node scripts/create-raidmap-indicator.mjs "PUB;a15e6773dfdd49b88b9f4cd5684556d8"
// Laeuft gegen die DATABASE_URL aus der Umgebung (.env) — sicherstellen, dass sie auf die
// gewuenschte (Production-)DB zeigt. Upsert per Slug: mehrfaches Ausfuehren ist harmlos.
import { PrismaClient } from '@prisma/client'

const pineId = process.argv[2]
if (!pineId || !pineId.startsWith('PUB;')) {
  console.error('Bitte pineId als Argument uebergeben, Format: "PUB;..."')
  process.exit(1)
}

const prisma = new PrismaClient()
const slug = 'pat-raid-map'

const data = {
  name: 'PAT Raid Map',
  shortDescription: 'Session bias & run timing for NQ — every level placebo-tested on 10 years of data.',
  detailDescription:
    'Shows the most likely first target of each session (DoL), the validated run-timing windows, purge-risk and follow-through bands. Trained 2016–2025, confirmed on a one-shot out-of-sample year (Jul 2025 – Jun 2026).',
  usageGuide: 'Add to an NQ/MNQ 1-minute chart. Full docs: price-action-trader.de/raid-map/docs',
  pineId,
  ready: true,
  visible: true,
}

const existing = await prisma.indicator.findUnique({ where: { slug } })
const row = existing
  ? await prisma.indicator.update({ where: { slug }, data })
  : await prisma.indicator.create({ data: { slug, sortOrder: 0, ...data } })

console.log(`${existing ? 'Aktualisiert' : 'Angelegt'}: ${row.name} (slug=${row.slug}, pineId=${row.pineId}, ready=${row.ready}, visible=${row.visible})`)
await prisma.$disconnect()
