import PayPalAdminClient from '@/components/owner/paypal-admin-client'
import { listPayPalSubscribers } from '@/lib/paypal-subscribers'

export const dynamic = 'force-dynamic'

export default async function PayPalAdminPage() {
  const subscribers = await listPayPalSubscribers()

  return <PayPalAdminClient initialSubscribers={subscribers} />
}
