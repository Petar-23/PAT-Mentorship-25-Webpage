// Validierung der Formulare /kuendigen und /widerrufen (serverseitig, zod).
// Bewusst ohne zusätzliche Hürden: kein Login, kein Captcha, keine Pflicht zur Begründung
// außer bei der außerordentlichen Kündigung (§ 312k Abs. 2 Satz 3 Nr. 1 a BGB).
//
// ANWALTLICH PRÜFEN: Pflichtfelder und Fehlermeldungen gehören zum Ablauf, den der Anwalt freigibt.

import { z } from 'zod'
import { CONTRACT_VALUES, berlinDateKey, isValidDateKey } from './vertrag-erklaerung.mjs'

const MESSAGES = {
  name: 'Bitte geben Sie Ihren Namen an.',
  email: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
  contract: 'Bitte wählen Sie den Vertrag aus.',
  kind: 'Bitte wählen Sie die Art der Kündigung.',
  reason: 'Bitte nennen Sie den Grund für die außerordentliche Kündigung.',
  timing: 'Bitte wählen Sie, wann die Kündigung wirken soll.',
  date: 'Bitte geben Sie ein gültiges Datum an.',
  datePast: 'Bitte wählen Sie ein Datum ab heute.',
  tooLong: 'Dieser Text ist zu lang.',
}

const text = (max, requiredMessage) =>
  z
    .string({ required_error: requiredMessage, invalid_type_error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(max, MESSAGES.tooLong)

const optionalText = (max) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === 'string' ? value.trim() : ''))
    .pipe(z.string().max(max, MESSAGES.tooLong))

const email = z
  .string({ required_error: MESSAGES.email, invalid_type_error: MESSAGES.email })
  .trim()
  .toLowerCase()
  .max(254, MESSAGES.email)
  .email(MESSAGES.email)

const contract = z.enum(/** @type {[string, ...string[]]} */ ([...CONTRACT_VALUES]), {
  errorMap: () => ({ message: MESSAGES.contract }),
})

const kuendigungSchema = z.object({
  kind: z.enum(['ordentlich', 'ausserordentlich'], { errorMap: () => ({ message: MESSAGES.kind }) }),
  reason: optionalText(2000),
  name: text(200, MESSAGES.name),
  accountEmail: email,
  contract,
  timing: z.enum(['naechstmoeglich', 'datum'], { errorMap: () => ({ message: MESSAGES.timing }) }),
  requestedDate: optionalText(10),
  confirmationEmail: optionalText(254),
})

const widerrufSchema = z.object({
  name: text(200, MESSAGES.name),
  email,
  contract,
  details: optionalText(1000),
})

/**
 * @param {import('zod').ZodError} error
 * @returns {Record<string, string>}
 */
function fieldErrors(error) {
  /** @type {Record<string, string>} */
  const errors = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form')
    if (!errors[field]) errors[field] = issue.message
  }
  return errors
}

/**
 * @typedef {{
 *   kind: 'ordentlich' | 'ausserordentlich',
 *   reason: string | null,
 *   name: string,
 *   accountEmail: string,
 *   contract: 'mentorship_stripe' | 'mentorship_paypal' | 'raidmap',
 *   timing: 'naechstmoeglich' | 'datum',
 *   requestedDate: string | null,
 *   confirmationEmail: string,
 * }} KuendigungData
 *
 * @typedef {{
 *   name: string,
 *   email: string,
 *   contract: 'mentorship_stripe' | 'mentorship_paypal' | 'raidmap',
 *   details: string | null,
 * }} WiderrufData
 */

/**
 * @param {unknown} input
 * @param {Date} [now]
 * @returns {{ ok: true, data: KuendigungData } | { ok: false, errors: Record<string, string> }}
 */
export function parseKuendigung(input, now = new Date()) {
  const raw = input && typeof input === 'object' ? /** @type {Record<string, unknown>} */ (input) : {}
  const parsed = kuendigungSchema.safeParse(raw)
  /** @type {Record<string, string>} */
  const errors = parsed.success ? {} : fieldErrors(parsed.error)

  // Abhängige Felder auch dann prüfen, wenn andere Felder fehlen: alle Hinweise auf einmal zeigen.
  const str = (value) => (typeof value === 'string' ? value.trim() : '')
  const kind = str(raw.kind)
  const reason = str(raw.reason)
  const timing = str(raw.timing)
  const requestedDateInput = str(raw.requestedDate)
  const confirmationInput = str(raw.confirmationEmail)

  if (kind === 'ausserordentlich' && !reason && !errors.reason) errors.reason = MESSAGES.reason

  let requestedDate = null
  if (timing === 'datum' && !errors.requestedDate) {
    if (!isValidDateKey(requestedDateInput)) errors.requestedDate = MESSAGES.date
    else if (requestedDateInput < berlinDateKey(now)) errors.requestedDate = MESSAGES.datePast
    else requestedDate = requestedDateInput
  }

  let confirmationEmail = null
  if (confirmationInput && !errors.confirmationEmail) {
    const checked = email.safeParse(confirmationInput)
    if (checked.success) confirmationEmail = checked.data
    else errors.confirmationEmail = MESSAGES.email
  }

  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors }

  const value = parsed.data
  return {
    ok: true,
    data: {
      kind: value.kind,
      reason: value.kind === 'ausserordentlich' ? value.reason : null,
      name: value.name,
      accountEmail: value.accountEmail,
      contract: /** @type {KuendigungData['contract']} */ (value.contract),
      timing: value.timing,
      requestedDate,
      confirmationEmail: confirmationEmail ?? value.accountEmail,
    },
  }
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, data: WiderrufData } | { ok: false, errors: Record<string, string> }}
 */
export function parseWiderruf(input) {
  const parsed = widerrufSchema.safeParse(input ?? {})
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }

  const value = parsed.data
  return {
    ok: true,
    data: {
      name: value.name,
      email: value.email,
      contract: /** @type {WiderrufData['contract']} */ (value.contract),
      details: value.details || null,
    },
  }
}
