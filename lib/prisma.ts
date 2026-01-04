import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  var prisma: PrismaClient | undefined
  var pgPool: Pool | undefined
}

// Vercel/Serverless: sehr kleine Pool-Größe, sonst drohen DB-Connection-Spikes und Timeouts (504).
const pool =
  global.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number.parseInt(process.env.PG_POOL_MAX ?? '1', 10) || 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

global.pgPool = pool
const adapter = new PrismaPg(pool)

export const prisma = global.prisma ?? new PrismaClient({ adapter })
global.prisma = prisma