import 'server-only'

import { createHash } from 'node:crypto'

import { prisma } from '@/lib/prisma'

// Serverless-taugliches Fixed-Window-Rate-Limit für PAT Research.
// Gleicher Algorithmus wie consumePersistentRateLimit auf dem Security-Branch
// (lib/security-rate-limit.ts), aber eigene Tabelle "ResearchRateLimit", damit
// dessen Migration beim späteren Merge nicht kollidiert.
//
// - Ein einziges atomares INSERT … ON CONFLICT DO UPDATE: auch parallele
//   Aufrufe (mehrere Lambdas) zählen lückenlos und ohne Doppelzählung.
// - Gespeichert wird nur der SHA-256-Hash von "research:v1:" + key, nie der
//   Schlüssel selbst (er kann eine User-ID oder IP enthalten).
// - Läuft das Fenster ab (resetAt <= jetzt), beginnt der nächste Aufruf bei 1.

export type ResearchRateLimitResult = {
  limited: boolean
  count: number
  retryAfterSeconds: number
}

export type ResearchRateLimitOptions = {
  key: string
  windowMs: number
  maxAttempts: number
}

const KEY_PREFIX = 'research:v1:'
const MAX_KEY_LENGTH = 512
// Obergrenze 1 Jahr: schützt vor Tippfehlern (Sekunden statt Millisekunden o. ä.).
const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000

export function hashResearchRateLimitKey(key: string): string {
  return createHash('sha256').update(`${KEY_PREFIX}${key}`).digest('hex')
}

function assertValidOptions(options: ResearchRateLimitOptions) {
  if (!options || typeof options !== 'object') {
    throw new Error('Invalid research rate-limit configuration')
  }

  const { key, windowMs, maxAttempts } = options
  if (typeof key !== 'string' || key.trim().length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new Error('Invalid research rate-limit key')
  }
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0 || windowMs > MAX_WINDOW_MS) {
    throw new Error('Invalid research rate-limit window')
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error('Invalid research rate-limit maxAttempts')
  }
}

export async function consumeResearchRateLimit(
  options: ResearchRateLimitOptions
): Promise<ResearchRateLimitResult> {
  assertValidOptions(options)

  const keyHash = hashResearchRateLimitKey(options.key)
  const now = new Date()
  const nextResetAt = new Date(now.getTime() + options.windowMs)

  const rows = await prisma.$queryRaw<Array<{ count: number | bigint; resetAt: Date | string }>>`
    INSERT INTO "ResearchRateLimit" ("keyHash", "count", "resetAt", "updatedAt")
    VALUES (${keyHash}, 1, ${nextResetAt}, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "count" = CASE
        WHEN "ResearchRateLimit"."resetAt" <= ${now} THEN 1
        ELSE "ResearchRateLimit"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "ResearchRateLimit"."resetAt" <= ${now} THEN ${nextResetAt}
        ELSE "ResearchRateLimit"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `

  const bucket = rows[0]
  if (!bucket) {
    throw new Error('Research rate-limit bucket was not returned')
  }

  const count = Number(bucket.count)
  const resetAtMs = new Date(bucket.resetAt).getTime()
  if (!Number.isSafeInteger(count) || !Number.isFinite(resetAtMs)) {
    throw new Error('Research rate-limit bucket is malformed')
  }

  return {
    limited: count > options.maxAttempts,
    count,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now.getTime()) / 1000)),
  }
}
