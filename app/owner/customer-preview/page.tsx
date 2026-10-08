import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomerPreviewAdmin } from '@/lib/customer-preview'
import { CustomerPreviewSearch } from '@/components/customer-preview-search'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Kundenvorschau · PAT', robots: { index: false, follow: false } }

export default async function CustomerPreviewSearchPage() {
  const admin = await getCustomerPreviewAdmin()
  if (!admin.ok && admin.status !== 503) notFound()
  return <main className="mx-auto max-w-2xl px-5 py-12">
    <Link href="/owner" prefetch={false} className="text-sm underline underline-offset-4">Zurück zur Verwaltung</Link>
    <h1 className="mt-7 text-3xl font-semibold tracking-tight">Als Kunde ansehen</h1>
    <p className="mt-3 text-gray-600">Prüfe Zugang, Kurse, Lektionen und Lernfortschritt aus Sicht eines Kunden.</p>
    <p className="mt-2 text-sm text-gray-600">Die Vorschau ist schreibgeschützt. Videos und PDFs lassen sich öffnen, Kundendaten und Abos bleiben unverändert.</p>
    {!admin.ok ? <p role="alert" className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      Die PAT-Organisation ist für die Vorschau noch nicht eingerichtet. Setze CLERK_ADMIN_ORGANIZATION_ID in der Server-Konfiguration.
    </p> : <CustomerPreviewSearch />}
  </main>
}
