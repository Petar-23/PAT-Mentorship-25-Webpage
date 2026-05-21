import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  var prisma: PrismaClient | undefined
  var pgPool: Pool | undefined
}

function getPool() {
  if (!global.pgPool) {
    // Vercel/Serverless: sehr kleine Pool-Größe, sonst drohen DB-Connection-Spikes und Timeouts (504).
    global.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number.parseInt(process.env.PG_POOL_MAX ?? '1', 10) || 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
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
