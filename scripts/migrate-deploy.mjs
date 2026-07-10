import { spawnSync } from 'node:child_process'
import path from 'node:path'

const migrationUrl =
  process.env.MIGRATION_DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim()

if (!migrationUrl) {
  console.error('Migration aborted: set MIGRATION_DATABASE_URL or DIRECT_URL.')
  process.exit(1)
}

const runtimeUrl = process.env.DATABASE_URL?.trim()
if (runtimeUrl && migrationUrl === runtimeUrl) {
  console.error(
    'Migration aborted: the migration URL must not be identical to the runtime DATABASE_URL.'
  )
  process.exit(1)
}

const executable = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
)

const result = spawnSync(executable, ['migrate', 'deploy'], {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, DATABASE_URL: migrationUrl },
})

if (result.error) {
  console.error(`Migration failed to start: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
