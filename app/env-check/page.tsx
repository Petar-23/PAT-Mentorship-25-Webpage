import { testConnection } from '@/lib/bunny'

async function BunnyTest() {
  try {
    const data = await testConnection()
    console.log('Full Bunny Data:', data) // Debug Console!
    return (
      <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
        <h3 className="font-bold text-green-800 mb-2">✓ Bunny Connected!</h3>
        <p className="text-sm mb-2 text-green-700">
          Videos: {data.totalItems ?? 0} | Seite: {data.currentPage ?? 1}
        </p>
        <details>
          <summary>Full JSON (klick)</summary>
          <pre className="mt-2 p-2 bg-white rounded text-xs max-h-40 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    )
  } catch (error: unknown) {
    console.error('Bunny Error:', error)
    return <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
      <h3 className="font-bold text-red-800 mb-2">Bunny Error</h3>
      <p>{String(error)}</p>
    </div>
  }
}

export default function EnvCheck() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Environment Check</h1>
      
      {/* Stripe */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Stripe</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm">
          {`
NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || '❌'}
STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✓' : '❌'}
STRIPE_PRICE_ID: ${process.env.STRIPE_PRICE_ID ? '✓' : '❌'}
STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✓' : '❌'}
          `.trim()}
        </pre>
      </section>

      {/* Whop */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Whop</h2>
        <pre className="bg-gray-100 p-6 rounded-lg font-mono text-sm">
          {`
WHOP_API_KEY: ${process.env.WHOP_API_KEY ? '✓' : '❌'}
WHOP_PRODUCT_ID: ${process.env.WHOP_PRODUCT_ID || '❌'}
WHOP_OFFER_ID: ${process.env.WHOP_OFFER_ID || '—'}
WHOP_STORE_ID: ${process.env.WHOP_STORE_ID || '—'}
          `.trim()}
        </pre>
      </section>

      {/* Bunny */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Bunny.net</h2>
        <BunnyTest />
      </section>
    </div>
  )
}