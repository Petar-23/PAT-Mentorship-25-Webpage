'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { customerPreviewBase } from '@/lib/customer-preview-policy'

export function CustomerPreviewSearch() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null)

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setCustomer(null)
    setError(null)
    try {
      const response = await fetch('/api/admin/customer-preview/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }), cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Die Suche ist gerade nicht verfügbar.')
      setCustomer(data.customer)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Die Suche ist gerade nicht verfügbar.')
    } finally {
      setPending(false)
    }
  }

  return <div className="mt-8 space-y-6">
    <form onSubmit={search} className="space-y-3">
      <label htmlFor="customer-email" className="block text-sm font-medium">E-Mail-Adresse des Kunden</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input id="customer-email" type="email" value={email} required autoComplete="off"
          disabled={pending} onChange={event => { setEmail(event.target.value); setCustomer(null); setError(null) }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border px-3" placeholder="name@beispiel.de" />
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-gray-900 px-5 text-white disabled:opacity-50">
          {pending ? 'Suche läuft…' : 'Kunde suchen'}
        </button>
      </div>
    </form>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {customer ? <div className="rounded-xl border p-5" role="status">
      <p className="font-semibold">{customer.name}</p>
      <p className="mt-1 break-all text-sm text-gray-600">{customer.email}</p>
      <Link href={customerPreviewBase(customer.id)} prefetch={false}
        className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-gray-900 px-4 text-white">Als Kunde ansehen</Link>
    </div> : null}
  </div>
}
