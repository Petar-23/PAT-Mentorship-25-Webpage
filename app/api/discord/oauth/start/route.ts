import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { buildDiscordAuthorizeUrl } from '@/lib/discord'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const state = randomBytes(16).toString('hex')
  const redirectUri = new URL('/api/discord/oauth/callback', req.url).toString()

  const authorizeUrl = buildDiscordAuthorizeUrl({ redirectUri, state })
  const res = NextResponse.redirect(authorizeUrl)

  res.cookies.set('discord_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 Minuten
  })

  res.cookies.set('discord_oauth_uid', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 Minuten
  })

  return res
}