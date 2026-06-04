import 'server-only'

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function getAgentUploadToken() {
  return process.env.AGENT_UPLOAD_TOKEN || process.env.HERMES_UPLOAD_TOKEN || null
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  )
}

function readBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (match?.[1]) return match[1].trim()

  return req.headers.get('x-agent-upload-token')?.trim() ?? null
}

export function requireAgentUploadAccess(req: NextRequest) {
  const expectedToken = getAgentUploadToken()

  if (!expectedToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Agent upload token is not configured' },
        { status: 503 }
      ),
    }
  }

  const providedToken = readBearerToken(req)
  if (!providedToken || !safeEqual(providedToken, expectedToken)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true as const }
}
