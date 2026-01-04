import { testConnection } from '@/lib/bunny'
import { getIsAdmin } from '@/lib/authz'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

function isSet(name: string) {
  return Boolean(process.env[name])
}

async function BunnyTest() {
  let data: Awaited<ReturnType<typeof testConnection>> | null = null
  let error: string | null = null

  try {
    data = await testConnection()
  } catch (err: unknown) {
    console.error('Bunny Error:', err)
    error = err instanceof Error ? err.message : String(err)
  }

  if (error) {
    return (
      <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
        <h3 className="font-bold text-red-800 mb-2">Bunny Error</h3>
        <p className="text-sm text-red-700 break-words">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
        <h3 className="font-bold text-red-800 mb-2">Bunny Error</h3>
        <p className="text-sm text-red-700">Unbekannter Fehler</p>
      </div>
    )
  }

  return (
    <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
      <h3 className="font-bold text-green-800 mb-2">✓ Bunny Connected!</h3>
      <p className="text-sm mb-2 text-green-700">
        Videos: {data.totalItems ?? 0} | Seite: {data.currentPage ?? 1}
      </p>
    </div>
  )
}

export default async function EnvCheck() {
  // Security: /env-check in Production nur für Admins
  if (process.env.NODE_ENV === 'production') {
    const { userId } = await auth()
    if (!userId) {
      redirect('/sign-in?redirect_url=/env-check')
    }
    const isAdmin = await getIsAdmin()
    if (!isAdmin) {
      redirect('/dashboard')
    }
  }

  const mentorshipStart = process.env.MENTORSHIP_START_DATE || '—'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Environment Check</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Core</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
          {`
NODE_ENV: ${process.env.NODE_ENV || '—'}
NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || '❌'}
DATABASE_URL: ${process.env.DATABASE_URL ? '✓' : '❌'}
MENTORSHIP_START_DATE: ${mentorshipStart}
          `.trim()}
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Clerk</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
          {`
CLERK_SECRET_KEY: ${isSet('CLERK_SECRET_KEY') ? '✓' : '❌'}
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${isSet('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') ? '✓' : '❌'}
          `.trim()}
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Stripe</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
          {`
STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✓' : '❌'}
STRIPE_PRICE_ID: ${process.env.STRIPE_PRICE_ID ? '✓' : '❌'}
STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✓' : '❌'}
          `.trim()}
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Discord</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
          {`
DISCORD_BOT_TOKEN: ${isSet('DISCORD_BOT_TOKEN') ? '✓' : '❌'}
DISCORD_CLIENT_ID: ${isSet('DISCORD_CLIENT_ID') ? '✓' : '❌'}
DISCORD_CLIENT_SECRET: ${isSet('DISCORD_CLIENT_SECRET') ? '✓' : '❌'}
DISCORD_GUILD_ID: ${isSet('DISCORD_GUILD_ID') ? '✓' : '❌'}
DISCORD_ROLE_MENTEE26_ID: ${isSet('DISCORD_ROLE_MENTEE26_ID') ? '✓' : '❌'}
DISCORD_ANNOUNCEMENTS_CHANNEL_ID: ${isSet('DISCORD_ANNOUNCEMENTS_CHANNEL_ID') ? '✓' : '❌'}
DISCORD_MOD_CHANNEL_ID: ${isSet('DISCORD_MOD_CHANNEL_ID') ? '✓' : '—'}
          `.trim()}
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Vercel Blob</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
          {`
BLOB_READ_WRITE_TOKEN: ${isSet('BLOB_READ_WRITE_TOKEN') ? '✓' : '❌'}
          `.trim()}
        </pre>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Whop</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
          {`
WHOP_API_KEY: ${process.env.WHOP_API_KEY ? '✓' : '❌'}
WHOP_PRODUCT_ID: ${process.env.WHOP_PRODUCT_ID || '❌'}
WHOP_OFFER_ID: ${process.env.WHOP_OFFER_ID || '—'}
WHOP_STORE_ID: ${process.env.WHOP_STORE_ID || '—'}
          `.trim()}
        </pre>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Bunny.net</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap mb-4">
          {`
BUNNY_LIBRARY_ID: ${isSet('BUNNY_LIBRARY_ID') ? '✓' : '❌'}
BUNNY_API_KEY: ${isSet('BUNNY_API_KEY') ? '✓' : '❌'}
NEXT_PUBLIC_BUNNY_LIBRARY_ID: ${isSet('NEXT_PUBLIC_BUNNY_LIBRARY_ID') ? '✓' : '❌'}
          `.trim()}
        </pre>
        <BunnyTest />
      </section>
    </div>
  )
}