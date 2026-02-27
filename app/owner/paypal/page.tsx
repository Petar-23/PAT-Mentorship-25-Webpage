'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Check, X, UserPlus } from 'lucide-react'

type PayPalSubscriber = {
  id: string
  paypalSubscriptionId: string
  paypalEmail: string
  status: string
  userId: string | null
  claimedAt: string | null
  createdAt: string
}

type ImportResult = {
  total: number
  imported: number
  active: number
  inactive: number
  alreadyExists: number
  errors: string[]
  details: Array<{
    subscriptionId: string
    email: string
    status: string
    name: string | null
  }>
}

export default function PayPalAdminPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const isAdmin =
    user?.organizationMemberships?.some((m) => m.role === 'org:admin') || false

  const [ids, setIds] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [subscribers, setSubscribers] = useState<PayPalSubscriber[]>([])
  const [loadingSubs, setLoadingSubs] = useState(true)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editUserId, setEditUserId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.replace('/')
      return
    }
    if (!isAdmin) {
      router.replace('/dashboard')
    }
  }, [isLoaded, isSignedIn, isAdmin, router])

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoadingSubs(true)
      const res = await fetch('/api/admin/paypal-subscribers')
      if (res.ok) {
        const data = await res.json()
        setSubscribers(data.subscribers || [])
      }
    } catch {
      console.error('Failed to load subscribers')
    } finally {
      setLoadingSubs(false)
    }
  }, [])

  useEffect(() => {
    if (isLoaded && isSignedIn && isAdmin) {
      fetchSubscribers()
    }
  }, [isLoaded, isSignedIn, isAdmin, fetchSubscribers])

  async function handleImport() {
    setError(null)
    setResult(null)
    setLoading(true)

    // IDs parsen: Zeilen, Kommas, Leerzeichen als Trennzeichen
    const subscriptionIds = ids
      .split(/[\n,;]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0)

    if (subscriptionIds.length === 0) {
      setError('Bitte gib mindestens eine Subscription ID ein.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin/import-paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionIds }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Import fehlgeschlagen')
        return
      }

      setResult(data)
      setIds('')
      // Subscriber-Liste aktualisieren
      fetchSubscribers()
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(sub: PayPalSubscriber) {
    setEditingId(sub.id)
    setEditUserId(sub.userId || '')
    setEditEmail(sub.paypalEmail)
    setEditStatus(sub.status)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveEdit(subId: string) {
    setEditSaving(true)
    setEditError(null)

    try {
      const res = await fetch('/api/admin/paypal-subscribers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subId,
          userId: editUserId.trim() || null,
          paypalEmail: editEmail.trim(),
          status: editStatus,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Speichern fehlgeschlagen')
        return
      }

      setEditingId(null)
      fetchSubscribers()
    } catch {
      setEditError('Netzwerkfehler')
    } finally {
      setEditSaving(false)
    }
  }

  if (!isLoaded || !isSignedIn || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">PayPal Import</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Importiere PayPal Subscription IDs und verwalte PayPal-Subscriber.
        </p>
      </div>

      {/* Anleitung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Anleitung: PayPal Subscription IDs finden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-neutral-600">
          <ol className="list-inside list-decimal space-y-2">
            <li>
              Gehe zu{' '}
              <a
                href="https://www.paypal.com/myaccount/autopay/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                paypal.com/myaccount/autopay
              </a>{' '}
              (Automatische Zahlungen)
            </li>
            <li>
              Klicke auf jedes aktive Abonnement deines Mentorship-Produkts
            </li>
            <li>
              Kopiere die{' '}
              <strong>Abrechnungsvereinbarungs-ID</strong> (beginnt mit{' '}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                I-
              </code>
              )
            </li>
            <li>Fuege alle IDs unten ein (eine pro Zeile)</li>
          </ol>
          <p className="mt-2 text-xs text-neutral-400">
            Alternativ: PayPal Dashboard → Berichte → Alle Transaktionen →
            Subscription-Transaktionen filtern → Subscription-ID aus den Details
            kopieren.
          </p>
        </CardContent>
      </Card>

      {/* Import-Formular */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription IDs importieren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={
              'Subscription IDs einfuegen (eine pro Zeile):\nI-ABC123DEF456\nI-GHI789JKL012\nI-MNO345PQR678'
            }
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            rows={6}
            disabled={loading}
            className="font-mono text-sm"
          />

          <div className="flex items-center gap-3">
            <Button onClick={handleImport} disabled={loading || !ids.trim()}>
              {loading ? 'Importiere...' : 'Importieren'}
            </Button>
            <span className="text-xs text-neutral-400">
              {ids
                .split(/[\n,;]+/)
                .map((id) => id.trim())
                .filter((id) => id.length > 0).length || 0}{' '}
              IDs erkannt
            </span>
          </div>

          {/* Fehler */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Ergebnis */}
          {result && (
            <div className="rounded-md bg-green-50 p-4 text-sm">
              <p className="font-medium text-green-800">
                Import abgeschlossen
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-green-700 sm:grid-cols-4">
                <div>
                  <span className="text-xs text-green-500">Importiert</span>
                  <p className="text-lg font-semibold">{result.imported}</p>
                </div>
                <div>
                  <span className="text-xs text-green-500">Aktiv</span>
                  <p className="text-lg font-semibold">{result.active}</p>
                </div>
                <div>
                  <span className="text-xs text-green-500">Inaktiv</span>
                  <p className="text-lg font-semibold">{result.inactive}</p>
                </div>
                <div>
                  <span className="text-xs text-green-500">
                    Bereits vorhanden
                  </span>
                  <p className="text-lg font-semibold">
                    {result.alreadyExists}
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-600">
                  <p className="font-medium">Fehler:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.details.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-green-600">Details:</p>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {result.details.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 border-b border-green-100 py-1 text-xs"
                      >
                        <span className="font-mono">{d.subscriptionId}</span>
                        <span className="text-green-500">→</span>
                        <span>{d.email}</span>
                        <span
                          className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            d.status === 'ACTIVE'
                              ? 'bg-green-200 text-green-800'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriber-Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Importierte PayPal-Subscriber{' '}
            <span className="text-sm font-normal text-neutral-400">
              ({subscribers.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSubs ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : subscribers.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              Noch keine PayPal-Subscriber importiert.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-neutral-500">
                    <th className="pb-2 pr-4">Subscription ID</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">User ID</th>
                    <th className="pb-2 pr-4">Claimed</th>
                    <th className="pb-2">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="py-2 pr-4 font-mono text-xs">
                        {sub.paypalSubscriptionId}
                      </td>

                      {editingId === sub.id ? (
                        <>
                          <td className="py-2 pr-4">
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="PayPal Email"
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="h-7 rounded border border-neutral-200 px-2 text-xs"
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="CANCELLED">CANCELLED</option>
                              <option value="SUSPENDED">SUSPENDED</option>
                              <option value="EXPIRED">EXPIRED</option>
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            <Input
                              value={editUserId}
                              onChange={(e) => setEditUserId(e.target.value)}
                              className="h-7 font-mono text-xs"
                              placeholder="user_..."
                            />
                          </td>
                          <td className="py-2 pr-4 text-xs text-neutral-400">
                            {sub.claimedAt
                              ? new Date(sub.claimedAt).toLocaleDateString('de-DE')
                              : '—'}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => saveEdit(sub.id)}
                                disabled={editSaving}
                                className="h-7 w-7 p-0"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={editSaving}
                                className="h-7 w-7 p-0"
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                            {editError && (
                              <p className="mt-1 text-[10px] text-red-500">{editError}</p>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-4">{sub.paypalEmail}</td>
                          <td className="py-2 pr-4">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                sub.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-700'
                                  : sub.status === 'CANCELLED'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            {sub.userId ? (
                              <span className="font-mono text-xs text-neutral-600">
                                {sub.userId.slice(0, 20)}…
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-neutral-400">
                                <UserPlus className="h-3 w-3" />
                                Nicht zugewiesen
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {sub.claimedAt ? (
                              <span className="text-green-600">
                                ✓{' '}
                                {new Date(sub.claimedAt).toLocaleDateString('de-DE')}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(sub)}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
