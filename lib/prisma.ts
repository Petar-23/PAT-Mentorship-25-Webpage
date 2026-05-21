import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  var prisma: PrismaClient | undefined
  var pgPool: Pool | undefined
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getPool() {
  if (!global.pgPool) {
    // Vercel/Serverless: sehr kleine Pool-Größe, sonst drohen DB-Connection-Spikes und Timeouts (504).
    global.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parsePositiveInt(process.env.PG_POOL_MAX, 1),
      idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
      connectionTimeoutMillis: parsePositiveInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10_000),
      keepAlive: true,
    })
  }

  return global.pgPool
}

export function getPrisma() {
  if (!global.prisma) {
    global.prisma = new PrismaClient({ adapter: new PrismaPg(getPool()) })
  }

  return global.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    const value = Reflect.get(client, prop, client) as unknown

    return typeof value === 'function' ? value.bind(client) : value
  },
})

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      'cause' in error && error.cause instanceof Error ? ` ${error.cause.message}` : ''
    return `${error.name}: ${error.message}${cause}`
  }

  return String(error)
}

export function isTransientDbConnectionError(error: unknown) {
  const message = getErrorMessage(error)

  return /connection terminated|timeout exceeded when trying to connect|connection timeout|terminating connection|econnreset|etimedout|p1001|p2024/i.test(
    message
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options: { label?: string; attempts?: number; delayMs?: number } = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2)
  const delayMs = Math.max(0, options.delayMs ?? 250)
  const label = options.label ?? 'Prisma operation'

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const shouldRetry = attempt < attempts && isTransientDbConnectionError(error)
      if (!shouldRetry) throw error

      console.warn(`${label} failed with a transient DB connection error; retrying`, {
        attempt,
        attempts,
      })
      await wait(delayMs * attempt)
    }
  }

  throw new Error(`${label} failed without returning a result`)
}
