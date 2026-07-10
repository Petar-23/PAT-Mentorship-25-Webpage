import 'server-only'

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const MIN_AGENT_TOKEN_LENGTH = 32
const MAX_AGENT_TOKEN_LENGTH = 512

function getAgentUploadToken() {
  const configured = process.env.AGENT_UPLOAD_TOKEN?.trim()
  if (!configured) return null
  if (configured.length < MIN_AGENT_TOKEN_LENGTH || configured.length > MAX_AGENT_TOKEN_LENGTH) {
    return null
  }
  return configured
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
  if (!match?.[1]) return null

  const token = match[1].trim()
  if (token.length < MIN_AGENT_TOKEN_LENGTH || token.length > MAX_AGENT_TOKEN_LENGTH) {
    return null
  }
  return token
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
