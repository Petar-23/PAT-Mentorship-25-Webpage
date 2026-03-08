import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv(file) {
  const full = path.join(root, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue
    const idx = line.indexOf('=')
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnv('.env')
loadEnv('.env.prod.fresh')

async function resolveBunnyThumbnailUrl(videoGuid, libraryId, referer) {
  const res = await fetch(`https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`, {
    headers: {
      Referer: referer,
      'User-Agent': 'Mozilla/5.0 OpenClaw Bunny Thumbnail Backfill',
    },
  })
  if (!res.ok) return null
  const html = await res.text()
  const match = html.match(/https:\/\/[^"'\s>]+\/thumbnail\.jpg/)
  return match?.[0] || null
}

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
const rows = (await client.query(`select id, title, "bunnyGuid", "thumbnailUrl" from "Video" where "bunnyGuid" is not null order by "createdAt" asc`)).rows
let updated = 0
for (const row of rows) {
  const thumb = await resolveBunnyThumbnailUrl(row.bunnyGuid, process.env.BUNNY_LIBRARY_ID, process.env.NEXT_PUBLIC_APP_URL)
  if (!thumb) {
    console.log(`MISS | ${row.title}`)
    continue
  }
  await client.query(`update "Video" set "thumbnailUrl" = $1, "updatedAt" = now() where id = $2`, [thumb, row.id])
  updated += 1
  console.log(`OK   | ${row.title} -> ${thumb}`)
}
console.log(`UPDATED=${updated}/${rows.length}`)
await client.end()
