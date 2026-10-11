import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCustomerPreviewAdmin } from '@/lib/customer-preview'

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

export async function POST(request: Request) {
  const admin = await getCustomerPreviewAdmin()
  if (!admin.ok) return json({ error: admin.status === 503
    ? 'Die Kundenvorschau muss zuerst für die PAT-Organisation eingerichtet werden.'
    : 'Kein Zugriff auf die Kundenvorschau.' }, admin.status)
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Ungültige Anfrage.' }, 403)
  let email: string
  try {
    const text = await request.text()
    if (text.length > 1024) return json({ error: 'Anfrage zu groß.' }, 413)
    const body = JSON.parse(text) as { email?: unknown }
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({ error: 'Bitte eine vollständige E-Mail-Adresse eingeben.' }, 400)
    }
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400)
  }
  const client = await clerkClient()
  const result = await client.users.getUserList({ emailAddress: [email], limit: 10 })
  // Exact primary-email match only. No customer directory or arbitrary Clerk data is exposed.
  const user = result.data.find(user => user.emailAddresses.some(address =>
    address.id === user.primaryEmailAddressId && address.emailAddress.toLowerCase() === email,
  ))
  if (!user) return json({ error: 'Kein Kundenkonto mit dieser primären E-Mail-Adresse gefunden.' }, 404)
  return json({ customer: {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Kunde',
    email,
  } })
}
