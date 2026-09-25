import 'server-only'

// Transaktionale E-Mails (derzeit Kündigungs- und Widerrufsbestätigungen samt internen Kopien) über
// Google Workspace: Gmail-API mit Dienstkonto und domänenweiter Delegation. JWT, MIME und
// Token-Cache stehen in lib/mailer-gmail.mjs (dort auch die Einrichtung), Tests daneben.
//
// Env:
// - GOOGLE_MAIL_SERVICE_ACCOUNT: JSON-Schlüssel des Dienstkontos, roh oder base64-kodiert.
// - MAIL_SENDER_EMAIL: Workspace-Postfach, in dessen Namen gesendet wird (Beispiel:
//   petar@price-action-trader.de). Gesendete Mails liegen auch in dessen Ordner "Gesendet".
// - MAIL_SENDER_NAME: Anzeigename, z. B. "Petar | Price Action Trader". Ohne Wert: PRICE ACTION TRADER.
//
// Fehlt die Konfiguration oder scheitert der Versand, wird geloggt und { ok: false } geliefert.
// sendMail wirft nie, damit Aufrufer (z. B. /kuendigen) ihre Bestätigung auf der Seite behalten.
// Der Lead-Magnet (app/api/lead-magnet) pflegt Kontakte weiter über Brevo, das ist davon getrennt.

import {
  MailError,
  createGmailSender,
  isEmailAddress,
  readMailerEnv,
  type GmailSender,
  type OutgoingMail,
} from '@/lib/mailer-gmail.mjs'

export type { OutgoingMail }

/** Einzelne Adresse, die der Versand akzeptiert (reines ASCII, ohne Anzeigename, ohne Liste). */
export function isMailAddress(value: unknown): value is string {
  return isEmailAddress(value)
}

export type MailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'invalid_config' | 'invalid_message' | 'token_failed' | 'send_failed' }

export type MailerStatus =
  | { status: 'ok'; senderEmail: string; senderName: string }
  | { status: 'missing'; missing: string[] }
  | { status: 'invalid'; error: string }

type EnvSnapshot = {
  GOOGLE_MAIL_SERVICE_ACCOUNT: string | undefined
  MAIL_SENDER_EMAIL: string | undefined
  MAIL_SENDER_NAME: string | undefined
}

// Eine Versender-Instanz je Konfiguration, damit das Zugangstoken im Modul bis kurz vor Ablauf
// wiederverwendet wird (auch über mehrere Aufrufe derselben warmen Funktion).
let current: { env: EnvSnapshot; sender: GmailSender } | null = null

function envSnapshot(): EnvSnapshot {
  return {
    GOOGLE_MAIL_SERVICE_ACCOUNT: process.env.GOOGLE_MAIL_SERVICE_ACCOUNT,
    MAIL_SENDER_EMAIL: process.env.MAIL_SENDER_EMAIL,
    MAIL_SENDER_NAME: process.env.MAIL_SENDER_NAME,
  }
}

function sameEnv(a: EnvSnapshot, b: EnvSnapshot) {
  return (
    a.GOOGLE_MAIL_SERVICE_ACCOUNT === b.GOOGLE_MAIL_SERVICE_ACCOUNT &&
    a.MAIL_SENDER_EMAIL === b.MAIL_SENDER_EMAIL &&
    a.MAIL_SENDER_NAME === b.MAIL_SENDER_NAME
  )
}

function getSender(): { sender: GmailSender } | { reason: 'not_configured' | 'invalid_config' } {
  const env = envSnapshot()
  if (current && sameEnv(current.env, env)) return { sender: current.sender }

  const config = readMailerEnv(env)
  if (config.status === 'missing') {
    console.warn(`[mail] ${config.missing.join('/')} not set, email skipped`)
    return { reason: 'not_configured' }
  }
  if (config.status === 'invalid') {
    console.error('[mail] Invalid mail configuration, email skipped:', config.error)
    return { reason: 'invalid_config' }
  }

  const sender = createGmailSender({
    serviceAccount: config.serviceAccount,
    senderEmail: config.senderEmail,
    senderName: config.senderName,
    fetch: (url, init) => fetch(url, init),
  })
  current = { env, sender }
  return { sender }
}

/**
 * Sendet eine Mail über Google Workspace. Wirft nie.
 * @param options.tag Nur für das Log, z. B. "kuendigung-eingang".
 * @param options.timeoutMs Zeitgrenze für Token und Versand zusammen.
 */
export async function sendMail(mail: OutgoingMail, options: { tag?: string; timeoutMs?: number } = {}): Promise<MailResult> {
  const tag = options.tag ?? 'mail'
  try {
    const resolved = getSender()
    if (!('sender' in resolved)) return { ok: false, reason: resolved.reason }
    const { id } = await resolved.sender.send(mail, { timeoutMs: options.timeoutMs })
    return { ok: true, id }
  } catch (error) {
    if (error instanceof MailError) {
      console.error(`[mail] ${tag}: ${error.code}:`, error.message)
      return { ok: false, reason: error.code }
    }
    console.error(`[mail] ${tag}: unexpected error:`, error)
    return { ok: false, reason: 'send_failed' }
  }
}

/** Für die Owner-Seite: ist der Versand eingerichtet? Ohne Netzaufruf und ohne Schlüsselmaterial. */
export function mailerStatus(): MailerStatus {
  const config = readMailerEnv(envSnapshot())
  if (config.status === 'ok') return { status: 'ok', senderEmail: config.senderEmail, senderName: config.senderName }
  return config
}
