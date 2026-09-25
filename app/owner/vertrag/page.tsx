import { mailerStatus } from '@/lib/mailer'
import { prisma } from '@/lib/prisma'
import { LIMITS } from '@/lib/vertrag-ablauf.mjs'
import { contractLabel, formatBerlinDate, formatBerlinDateTime, formatDateKey, kindLabel } from '@/lib/vertrag-erklaerung.mjs'

// Nur für Admins (app/owner/layout.tsx prüft das). Telegram meldet nur die Eingangs-ID,
// die Details stehen hier.

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  received: 'eingegangen',
  scheduled: 'in Stripe vorgemerkt',
  already_scheduled: 'war schon gekündigt',
  manual: 'manuell bearbeiten',
}

export default async function OwnerVertragPage() {
  let rows: Awaited<ReturnType<typeof prisma.contractDeclaration.findMany>> = []
  let loadError: string | null = null
  try {
    rows = await prisma.contractDeclaration.findMany({ orderBy: { receivedAt: 'desc' }, take: 200 })
  } catch (error) {
    console.error('Failed to load contract declarations:', error)
    loadError =
      'Die Eingänge konnten nicht geladen werden. Sind die Migrationen 20260925120000_add_contract_declaration und 20260925180000_contract_declaration_abuse_guard eingespielt?'
  }

  const mail = mailerStatus()

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-neutral-900">Kündigungen und Widerrufe</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-600">
        Eingänge aus /kuendigen und /widerrufen, neueste zuerst (höchstens 200). Kündigungen über Stripe sind in der
        Regel schon zum Periodenende vorgemerkt. Widerrufe, PayPal und alle Fälle mit Status „manuell bearbeiten“ brauchen
        deine Bearbeitung. Die vollständige Bestätigung (bei Kündigungen mit Vertragsende) geht automatisch nur an eine
        Adresse, die bei Stripe, Clerk oder in der PayPal-Liste zum Vertrag hinterlegt ist. Fehlt sie, bitte selbst an die
        hinterlegte Adresse senden. Über dem Limit ({LIMITS.maxPerEmail} Erklärungen je E-Mail-Adresse bzw. {LIMITS.maxPerIp} je IP in 24
        Stunden) geht keine Mail raus. Über {LIMITS.maxPerDay} Erklärungen insgesamt in 24 Stunden gehen keine Mails mehr an nicht hinterlegte Adressen, und
        Telegram meldet nur noch Eingänge mit gefundenem Vertrag.
      </p>

      {mail.status === 'ok' ? (
        <p className="mt-2 max-w-3xl text-sm text-neutral-600">
          Bestätigungen gehen über Google Workspace (Gmail-API) von {mail.senderEmail} als „{mail.senderName}“. Kopien liegen
          im Ordner „Gesendet“ dieses Postfachs.
        </p>
      ) : (
        <p className="mt-2 max-w-3xl text-sm text-red-700">
          {mail.status === 'missing'
            ? `E-Mail-Versand nicht eingerichtet: ${mail.missing.join(' und ')} ${mail.missing.length > 1 ? 'fehlen' : 'fehlt'}. Bis dahin geht keine Bestätigung raus.`
            : `E-Mail-Versand falsch eingerichtet: ${mail.error}. Bis dahin geht keine Bestätigung raus.`}{' '}
          Nötig sind ein Google-Dienstkonto mit domänenweiter Delegation für den Bereich gmail.send
          (GOOGLE_MAIL_SERVICE_ACCOUNT) und das Workspace-Postfach als Absender (MAIL_SENDER_EMAIL).
        </p>
      )}

      {loadError ? <p className="mt-6 text-sm text-red-700">{loadError}</p> : null}
      {!loadError && rows.length === 0 ? <p className="mt-6 text-sm text-neutral-600">Noch keine Eingänge.</p> : null}

      {rows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Eingangs-ID</th>
                <th className="px-3 py-2 font-medium">Eingang</th>
                <th className="px-3 py-2 font-medium">Vertrag</th>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Angaben</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Vertragsende</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 align-top text-neutral-900">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{row.id}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatBerlinDateTime(row.receivedAt)}</td>
                  <td className="px-3 py-2">{contractLabel(row.contract)}</td>
                  <td className="px-3 py-2">
                    <div>{row.name}</div>
                    <div className="text-neutral-600">{row.email}</div>
                    {row.confirmationEmail !== row.email ? (
                      <div className="text-neutral-600">Bestätigung an: {row.confirmationEmail}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.type === 'widerruf' ? 'Widerruf' : kindLabel(row.kind ?? '')}</div>
                    {row.reason ? <div className="whitespace-pre-wrap text-neutral-600">Grund: {row.reason}</div> : null}
                    {row.type === 'kuendigung' ? (
                      <div className="text-neutral-600">
                        Gewünscht:{' '}
                        {row.requestedDate ? `zum ${formatDateKey(row.requestedDate.toISOString().slice(0, 10))}` : 'nächstmöglich'}
                      </div>
                    ) : null}
                    {row.details ? <div className="whitespace-pre-wrap text-neutral-600">{row.details}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div>{STATUS_LABEL[row.status] ?? row.status}</div>
                    {row.statusNote ? <div className="text-neutral-600">{row.statusNote}</div> : null}
                    {row.stripeSubscriptionId ? <div className="font-mono text-xs text-neutral-600">{row.stripeSubscriptionId}</div> : null}
                    {row.mailNote ? <div className="text-neutral-600">Mail: {row.mailNote}</div> : null}
                    {!row.confirmationSentAt ? (
                      <div className="text-red-700">Vollständige Bestätigung noch nicht an hinterlegte Adresse versendet</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.endsAt ? formatBerlinDate(row.endsAt) : 'offen'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
