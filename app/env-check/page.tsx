// src/app/env-check/page.tsx
export default function EnvCheck() {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Environment Variables Check</h1>
        <pre className="bg-gray-100 p-4 rounded-lg">
          {`
  NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || '❌ missing'}
  STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✓ set' : '❌ missing'}
  STRIPE_PRICE_ID: ${process.env.STRIPE_PRICE_ID ? '✓ set' : '❌ missing'}
  STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✓ set' : '❌ missing'}
          `.trim()}
        </pre>
        
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h2 className="font-semibold">Expected Values:</h2>
          <ul className="list-disc list-inside mt-2">
            <li>NEXT_PUBLIC_APP_URL should be: http://localhost:3000</li>
            <li>STRIPE_SECRET_KEY should start with: sk_test_</li>
            <li>STRIPE_PRICE_ID should start with: price_</li>
            <li>STRIPE_WEBHOOK_SECRET should start with: whsec_</li>
          </ul>
        </div>
      </div>
    )
  }