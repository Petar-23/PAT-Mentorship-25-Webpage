// lib/paypal.ts – PayPal Subscriptions API Client

const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

// ---- OAuth2 Token ----

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const clientId = requireEnv('PAYPAL_CLIENT_ID')
  const clientSecret = requireEnv('PAYPAL_CLIENT_SECRET')

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`PayPal token request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    access_token: string
    token_type: string
    expires_in: number
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

// ---- Subscription Status ----

export type PayPalSubscriptionInfo = {
  id: string
  status: string // ACTIVE | CANCELLED | SUSPENDED | EXPIRED | APPROVAL_PENDING
  subscriberEmail: string
  subscriberName: string | null
  planId: string
  startTime: string
  statusUpdateTime: string | null
}

export async function getPayPalSubscription(
  subscriptionId: string
): Promise<PayPalSubscriptionInfo> {
  const token = await getPayPalAccessToken()

  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `PayPal subscription lookup failed (${res.status}): ${text}`
    )
  }

  const data = (await res.json()) as {
    id: string
    status: string
    subscriber?: {
      email_address?: string
      name?: { given_name?: string; surname?: string }
    }
    plan_id?: string
    start_time?: string
    status_update_time?: string
  }

  const subscriber = data.subscriber ?? {}
  const name = subscriber.name
    ? [subscriber.name.given_name, subscriber.name.surname]
        .filter(Boolean)
        .join(' ') || null
    : null

  return {
    id: data.id,
    status: data.status,
    subscriberEmail: subscriber.email_address ?? '',
    subscriberName: name,
    planId: data.plan_id ?? '',
    startTime: data.start_time ?? '',
    statusUpdateTime: data.status_update_time ?? null,
  }
}

// ---- Webhook Verification ----

export async function verifyPayPalWebhookSignature(params: {
  webhookId: string
  headers: Record<string, string>
  body: string
}): Promise<boolean> {
  const token = await getPayPalAccessToken()

  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: params.headers['paypal-auth-algo'] ?? '',
        cert_url: params.headers['paypal-cert-url'] ?? '',
        transmission_id: params.headers['paypal-transmission-id'] ?? '',
        transmission_sig: params.headers['paypal-transmission-sig'] ?? '',
        transmission_time: params.headers['paypal-transmission-time'] ?? '',
        webhook_id: params.webhookId,
        webhook_event: JSON.parse(params.body),
      }),
    }
  )

  if (!res.ok) {
    console.error('PayPal webhook verification request failed:', res.status)
    return false
  }

  const data = (await res.json()) as { verification_status: string }
  return data.verification_status === 'SUCCESS'
}
