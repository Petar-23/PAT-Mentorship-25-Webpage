import 'server-only'

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

type RateLimitResult = {
  limited: boolean
  count: number
  retryAfterSeconds: number
}

export async function consumePersistentRateLimit(options: {
  key: string
  windowMs: number
  maxAttempts: number
}): Promise<RateLimitResult> {
  if (!options.key || options.windowMs <= 0 || options.maxAttempts <= 0) {
    throw new Error('Invalid persistent rate-limit configuration')
  }

  const keyHash = createHash('sha256').update(options.key).digest('hex')
  const now = new Date()
  const nextResetAt = new Date(now.getTime() + options.windowMs)
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("keyHash", "count", "resetAt", "updatedAt")
    VALUES (${keyHash}, 1, ${nextResetAt}, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextResetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `

  const bucket = rows[0]
  if (!bucket) {
    throw new Error('Persistent rate-limit bucket was not returned')
  }

  return {
    limited: bucket.count > options.maxAttempts,
    count: bucket.count,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)
    ),
  }
}
