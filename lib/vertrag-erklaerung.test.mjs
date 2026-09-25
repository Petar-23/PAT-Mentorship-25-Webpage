import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LABELS,
  CONTRACT_VALUES,
  berlinDateKey,
  formatBerlinDateTime,
  isValidDateKey,
  createDeclarationId,
  escapeStripeSearchValue,
  parseIdList,
  subscriptionMatchesContract,
  openSubscriptionsFor,
  sameEmail,
  decideCancellation,
  buildCancellationReceipt,
  buildWithdrawalReceipt,
  describeCancellationOutcome,
  receiptToText,
  buildConfirmationEmail,
  buildNeutralEmail,
  defangLinks,
  sanitizeName,
  createRateLimiter,
  CANCELLATION_NOTICE,
  WITHDRAWAL_NOTICE,
  WITHDRAWAL_OUTCOME,
  STATUS_NOTE_TEXT,
} from './vertrag-erklaerung.mjs'
import { parseKuendigung, parseWiderruf } from './vertrag-validierung.mjs'

const NOW = new Date('2026-09-25T12:00:00Z')
const DASHES = /[\u2013\u2014]/

const validKuendigung = {
  kind: 'ordentlich',
  reason: '',
  name: '  Max Muster ',
  accountEmail: ' Max@Example.de ',
  contract: 'mentorship_stripe',
  timing: 'naechstmoeglich',
  requestedDate: '',
  confirmationEmail: '',
}

const priceConfig = { mentorshipPriceIds: ['price_m26', 'price_m25'], raidmapPriceIds: ['price_rm_month', 'price_rm_year'] }
const unix = (iso) => Math.floor(new Date(iso).getTime() / 1000)
const sub = (overrides = {}) => ({
  id: 'sub_1',
  status: 'active',
  cancelAtPeriodEnd: false,
  cancelAt: null,
  currentPeriodEnd: unix('2026-10-12T09:30:00Z'),
  created: unix('2026-03-12T09:30:00Z'),
  product: null,
  priceIds: ['price_m26'],
  ...overrides,
})
const decide = (subscriptions, overrides = {}) =>
  decideCancellation({
    subscriptions,
    contract: 'mentorship_stripe',
    kind: 'ordentlich',
    timing: 'naechstmoeglich',
    requestedDate: null,
    priceConfig,
    now: NOW,
    ...overrides,
  })

test('statutory button labels are exact', () => {
  assert.equal(LABELS.cancelEntry, 'Verträge hier kündigen')
  assert.equal(LABELS.cancelConfirm, 'jetzt kündigen')
  assert.equal(LABELS.withdrawEntry, 'Vertrag widerrufen')
  assert.equal(LABELS.withdrawConfirm, 'Widerruf bestätigen')
})

test('parseKuendigung normalises input and falls back to the account email for the confirmation', () => {
  const result = parseKuendigung(validKuendigung, NOW)
  assert.equal(result.ok, true)
  assert.deepEqual(result.data, {
    kind: 'ordentlich',
    reason: null,
    name: 'Max Muster',
    accountEmail: 'max@example.de',
    contract: 'mentorship_stripe',
    timing: 'naechstmoeglich',
    requestedDate: null,
    confirmationEmail: 'max@example.de',
  })
})

test('parseKuendigung requires name, a valid email and a known contract', () => {
  const result = parseKuendigung({ ...validKuendigung, name: ' ', accountEmail: 'kein-at', contract: 'anderes' }, NOW)
  assert.equal(result.ok, false)
  assert.ok(result.errors.name)
  assert.ok(result.errors.accountEmail)
  assert.ok(result.errors.contract)
  assert.equal(parseKuendigung(null, NOW).ok, false)
})

test('parseKuendigung reports dependent field errors together with missing fields', () => {
  const result = parseKuendigung({ kind: 'ausserordentlich', name: '', accountEmail: 'x', contract: 'foo', timing: 'datum', requestedDate: '2020-01-01', confirmationEmail: 'kaputt' }, NOW)
  assert.equal(result.ok, false)
  assert.deepEqual(Object.keys(result.errors).sort(), ['accountEmail', 'confirmationEmail', 'contract', 'name', 'reason', 'requestedDate'])
})

test('parseKuendigung requires a reason only for an extraordinary termination', () => {
  const missing = parseKuendigung({ ...validKuendigung, kind: 'ausserordentlich' }, NOW)
  assert.equal(missing.ok, false)
  assert.ok(missing.errors.reason)

  const given = parseKuendigung({ ...validKuendigung, kind: 'ausserordentlich', reason: ' Leistung fällt dauerhaft aus ' }, NOW)
  assert.equal(given.ok, true)
  assert.equal(given.data.reason, 'Leistung fällt dauerhaft aus')

  const ordinary = parseKuendigung({ ...validKuendigung, reason: 'egal' }, NOW)
  assert.equal(ordinary.data.reason, null)
})

test('parseKuendigung checks the requested date against today in German time', () => {
  assert.ok(parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '' }, NOW).errors.requestedDate)
  assert.ok(parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '2026-02-31' }, NOW).errors.requestedDate)
  assert.ok(parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '2026-09-24' }, NOW).errors.requestedDate)
  const today = parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '2026-09-25' }, NOW)
  assert.equal(today.ok, true)
  assert.equal(today.data.requestedDate, '2026-09-25')
  // Nach Mitternacht deutscher Zeit ist in UTC noch der Vortag.
  const lateNight = new Date('2026-09-25T22:30:00Z')
  assert.ok(parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '2026-09-25' }, lateNight).errors.requestedDate)
  // Ein Datum wird ignoriert, wenn "nächstmöglich" gewählt ist.
  assert.equal(parseKuendigung({ ...validKuendigung, requestedDate: 'Unsinn' }, NOW).data.requestedDate, null)
})

test('parseKuendigung validates a separate confirmation email', () => {
  assert.ok(parseKuendigung({ ...validKuendigung, confirmationEmail: 'falsch' }, NOW).errors.confirmationEmail)
  assert.equal(parseKuendigung({ ...validKuendigung, confirmationEmail: 'Other@Example.de' }, NOW).data.confirmationEmail, 'other@example.de')
})

test('parseKuendigung rejects oversized input', () => {
  assert.ok(parseKuendigung({ ...validKuendigung, name: 'x'.repeat(201) }, NOW).errors.name)
  assert.ok(parseKuendigung({ ...validKuendigung, kind: 'ausserordentlich', reason: 'x'.repeat(2001) }, NOW).errors.reason)
})

test('parseWiderruf accepts name, email, contract and optional details', () => {
  const result = parseWiderruf({ name: 'Erika Muster', email: 'ERIKA@example.de', contract: 'raidmap', details: '  ' })
  assert.deepEqual(result, { ok: true, data: { name: 'Erika Muster', email: 'erika@example.de', contract: 'raidmap', details: null } })
  const invalid = parseWiderruf({ name: '', email: 'x', contract: '' })
  assert.equal(invalid.ok, false)
  assert.deepEqual(Object.keys(invalid.errors).sort(), ['contract', 'email', 'name'])
  assert.deepEqual([...CONTRACT_VALUES], ['mentorship_stripe', 'mentorship_paypal', 'raidmap'])
})

test('dates are formatted in German time', () => {
  assert.equal(berlinDateKey(new Date('2026-09-25T22:30:00Z')), '2026-09-26')
  assert.equal(formatBerlinDateTime(new Date('2026-09-25T12:03:04Z')), '25.09.2026 um 14:03:04 Uhr (MESZ)')
  assert.equal(formatBerlinDateTime(new Date('2026-12-01T08:00:00Z')), '01.12.2026 um 09:00:00 Uhr (MEZ)')
  assert.equal(isValidDateKey('2028-02-29'), true)
  assert.equal(isValidDateKey('2027-02-29'), false)
})

test('declaration ids carry type, German date and a readable suffix', () => {
  const bytes = Uint8Array.from([0, 1, 31, 32, 255, 18])
  assert.equal(createDeclarationId('kuendigung', NOW, bytes), 'K-260925-01Z0ZJ')
  assert.match(createDeclarationId('widerruf', NOW, bytes), /^W-260925-[0-9A-Z]{6}$/)
})

test('stripe search values are escaped and id lists parsed', () => {
  assert.equal(escapeStripeSearchValue("o'neil@example.de"), "o\\'neil@example.de")
  assert.equal(escapeStripeSearchValue('a\\b'), 'a\\\\b')
  assert.deepEqual(parseIdList(' price_a, ,price_b '), ['price_a', 'price_b'])
  assert.deepEqual(parseIdList(undefined), [])
})

test('customer emails must match exactly, not just contain the same words', () => {
  assert.equal(sameEmail('Max@Example.de', 'max@example.de'), true)
  assert.equal(sameEmail(' max@example.de ', 'max@example.de'), true)
  assert.equal(sameEmail('anna.max@example.de', 'max@example.de'), false)
  assert.equal(sameEmail('max@example.de.evil.com', 'max@example.de'), false)
  assert.equal(sameEmail(null, 'max@example.de'), false)
  assert.equal(sameEmail('', ''), false)
})

test('only running subscriptions of the chosen contract count as open', () => {
  const subscriptions = [
    sub({ id: 'sub_old', status: 'canceled' }),
    sub({ id: 'sub_rm', product: 'raidmap', priceIds: ['price_rm_month'] }),
    sub({ id: 'sub_new', status: 'past_due' }),
  ]
  assert.deepEqual(openSubscriptionsFor(subscriptions, 'mentorship_stripe', priceConfig).map((s) => s.id), ['sub_new'])
  assert.deepEqual(openSubscriptionsFor([sub({ status: 'canceled' })], 'mentorship_stripe', priceConfig), [])
})

test('subscriptions are matched to the chosen contract only via known prices', () => {
  assert.equal(subscriptionMatchesContract(sub(), 'mentorship_stripe', priceConfig), true)
  assert.equal(subscriptionMatchesContract(sub({ priceIds: ['price_unknown'] }), 'mentorship_stripe', priceConfig), false)
  assert.equal(subscriptionMatchesContract(sub(), 'mentorship_stripe', { ...priceConfig, mentorshipPriceIds: [] }), false)
  assert.equal(subscriptionMatchesContract(sub({ product: 'raidmap', priceIds: ['price_m26'] }), 'mentorship_stripe', priceConfig), false)
  assert.equal(subscriptionMatchesContract(sub({ priceIds: ['price_rm_year'] }), 'raidmap', priceConfig), true)
  assert.equal(subscriptionMatchesContract(sub({ product: 'raidmap', priceIds: ['price_old'] }), 'raidmap', priceConfig), true)
  assert.equal(subscriptionMatchesContract(sub(), 'raidmap', priceConfig), false)
  assert.equal(subscriptionMatchesContract(sub(), 'mentorship_paypal', priceConfig), false)
})

test('one running subscription is scheduled to end at the current period end', () => {
  const decision = decide([sub(), sub({ id: 'sub_old', status: 'canceled', priceIds: ['price_m25'] }), sub({ id: 'sub_rm', product: 'raidmap', priceIds: ['price_rm_month'] })])
  assert.equal(decision.action, 'schedule')
  assert.equal(decision.subscriptionId, 'sub_1')
  assert.equal(decision.endsAt.toISOString(), '2026-10-12T09:30:00.000Z')
  assert.equal(decision.needsReview, false)
})

test('raid map trial is scheduled to end with the trial period', () => {
  const decision = decide([sub(), sub({ id: 'sub_rm', status: 'trialing', product: 'raidmap', priceIds: ['price_rm_month'], currentPeriodEnd: unix('2026-09-30T10:00:00Z') })], { contract: 'raidmap' })
  assert.equal(decision.action, 'schedule')
  assert.equal(decision.subscriptionId, 'sub_rm')
  assert.equal(decision.endsAt.toISOString(), '2026-09-30T10:00:00.000Z')
})

test('paypal, missing or ambiguous subscriptions go to manual handling', () => {
  assert.deepEqual(
    { ...decide([sub()], { contract: 'mentorship_paypal' }), endsAt: null },
    { action: 'manual', reason: 'paypal', subscriptionId: null, endsAt: null, needsReview: true }
  )
  assert.equal(decide([]).reason, 'no_subscription')
  assert.equal(decide([sub({ status: 'canceled' }), sub({ status: 'incomplete_expired' })]).reason, 'no_subscription')
  assert.equal(decide([sub(), sub({ id: 'sub_2' })]).reason, 'multiple_subscriptions')
  assert.equal(decide([sub({ currentPeriodEnd: null })]).reason, 'no_period_end')
  const passed = decide([sub({ status: 'unpaid', currentPeriodEnd: unix('2026-09-01T00:00:00Z') })])
  assert.equal(passed.action, 'manual')
  assert.equal(passed.reason, 'period_end_passed')
  assert.equal(passed.subscriptionId, 'sub_1')
})

test('an existing cancellation is kept', () => {
  const atPeriodEnd = decide([sub({ cancelAtPeriodEnd: true })])
  assert.equal(atPeriodEnd.action, 'already_scheduled')
  assert.equal(atPeriodEnd.endsAt.toISOString(), '2026-10-12T09:30:00.000Z')

  const earlier = decide([sub({ cancelAt: unix('2026-10-01T00:00:00Z') })])
  assert.equal(earlier.action, 'already_scheduled')
  assert.equal(earlier.endsAt.toISOString(), '2026-10-01T00:00:00.000Z')

  assert.equal(decide([sub({ cancelAt: unix('2027-01-01T00:00:00Z') })]).reason, 'cancel_at_after_period_end')
})

test('a requested date up to the period end ends the contract at the period end, a later one is manual', () => {
  const before = decide([sub()], { timing: 'datum', requestedDate: '2026-09-30' })
  assert.equal(before.action, 'schedule')
  assert.equal(before.endsAt.toISOString(), '2026-10-12T09:30:00.000Z')
  assert.equal(decide([sub()], { timing: 'datum', requestedDate: '2026-10-12' }).action, 'schedule')
  const later = decide([sub()], { timing: 'datum', requestedDate: '2026-10-13' })
  assert.equal(later.action, 'manual')
  assert.equal(later.reason, 'requested_date_after_period_end')
})

test('extraordinary termination is scheduled at the latest to the period end and flagged for review', () => {
  const decision = decide([sub()], { kind: 'ausserordentlich' })
  assert.equal(decision.action, 'schedule')
  assert.equal(decision.needsReview, true)
})

test('cancellation receipt on screen contains the own input, time of receipt and a fixed notice, never the contract end', () => {
  const data = parseKuendigung({ ...validKuendigung, kind: 'ausserordentlich', reason: 'Grund <b>', timing: 'datum', requestedDate: '2026-10-01' }, NOW).data
  const receipt = buildCancellationReceipt({ id: 'K-260925-ABCDEF', receivedAt: NOW, data })
  const labels = receipt.lines.map((line) => line.label)
  assert.deepEqual(labels, ['Eingangs-ID', 'Eingang', 'Art der Kündigung', 'Kündigungsgrund', 'Name', 'E-Mail-Adresse des Kontos', 'Vertrag', 'Gewünschtes Vertragsende'])
  assert.equal(receipt.receivedAtText, '25.09.2026 um 14:00:00 Uhr (MESZ)')
  assert.match(receipt.submittedVia, /„jetzt kündigen“/)
  assert.equal(receipt.notice, CANCELLATION_NOTICE)
  assert.equal(receipt.notice, 'Die Bestätigung mit dem Zeitpunkt, zu dem der Vertrag endet, senden wir an die E-Mail-Adresse, die zu Ihrem Vertrag hinterlegt ist.')
  assert.equal(receipt.lines.find((line) => line.label === 'Gewünschtes Vertragsende').value, 'zum 01.10.2026')
  assert.deepEqual(Object.keys(receipt).sort(), ['id', 'lines', 'notice', 'receivedAt', 'receivedAtText', 'statement', 'submittedVia', 'title', 'type'])
  assert.equal(/endet am|spätestens|bereits zum/.test(receiptToText(receipt)), false)

  // Eine abweichende Adresse steht als eigene Angabe in der Bestätigung.
  const other = buildCancellationReceipt({ id: 'K-1', receivedAt: NOW, data: parseKuendigung({ ...validKuendigung, confirmationEmail: 'andere@example.de' }, NOW).data })
  assert.equal(other.lines.at(-1).label, 'Weitere E-Mail-Adresse für eine Eingangsbestätigung')
  assert.equal(other.lines.at(-1).value, 'andere@example.de')
})

test('the contract end is described only for the mail to the stored address', () => {
  const data = parseKuendigung(validKuendigung, NOW).data
  assert.match(describeCancellationOutcome({ data, decision: decide([]) }), /gesondert per E-Mail/)
  assert.equal(describeCancellationOutcome({ data, decision: decide([sub()]) }), 'Ihr Vertrag endet am 12.10.2026.')
  assert.match(describeCancellationOutcome({ data, decision: decide([sub()], { kind: 'ausserordentlich' }) }), /spätestens am 12\.10\.2026/)
  assert.match(describeCancellationOutcome({ data, decision: decide([sub({ cancelAtPeriodEnd: true })]) }), /bereits zum 12\.10\.2026/)

  // Wunschdatum vor dem Periodenende: Das Ende wird erklärt, nicht stillschweigend verschoben.
  const earlyData = parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '2026-09-30' }, NOW).data
  const early = describeCancellationOutcome({ data: earlyData, decision: decide([sub()], { timing: 'datum', requestedDate: '2026-09-30' }) })
  assert.match(early, /^Ihr Vertrag endet am 12\.10\.2026\. Das ist der nächstmögliche Zeitpunkt/)
  assert.equal(DASHES.test(early), false)
  const sameDayData = parseKuendigung({ ...validKuendigung, timing: 'datum', requestedDate: '2026-10-12' }, NOW).data
  assert.equal(describeCancellationOutcome({ data: sameDayData, decision: decide([sub()], { timing: 'datum', requestedDate: '2026-10-12' }) }), 'Ihr Vertrag endet am 12.10.2026.')
})

test('withdrawal receipt and full email escape user input and avoid long dashes', () => {
  const receipt = buildWithdrawalReceipt({ id: 'W-260925-ABCDEF', receivedAt: NOW, data: { name: '<script>x</script>', email: 'a@b.de', contract: 'raidmap', details: 'Bestellt am 20.09.' } })
  assert.match(receipt.submittedVia, /„Widerruf bestätigen“/)
  assert.equal(receipt.notice, WITHDRAWAL_NOTICE)
  const mail = buildConfirmationEmail(receipt, { outcome: WITHDRAWAL_OUTCOME })
  assert.equal(mail.subject, 'Eingangsbestätigung Ihres Widerrufs (W-260925-ABCDEF)')
  assert.equal(mail.html.includes('<script>'), false)
  assert.match(mail.html, /&lt;script&gt;/)
  assert.match(mail.text, /Eingang: 25\.09\.2026 um 14:00:00 Uhr \(MESZ\)/)
  assert.match(mail.text, /Weitere Angaben zum Vertrag: Bestellt am 20\.09\./)
  for (const value of [mail.subject, mail.text, mail.html, receiptToText(receipt)]) assert.equal(DASHES.test(value), false)

  const cancelReceipt = buildCancellationReceipt({ id: 'K-3', receivedAt: NOW, data: parseKuendigung(validKuendigung, NOW).data })
  const cancel = buildConfirmationEmail(cancelReceipt, { outcome: 'Ihr Vertrag endet am 12.10.2026.' })
  assert.equal(cancel.subject, 'Bestätigung Ihrer Kündigung (K-3)')
  assert.match(cancel.text, /Vertrag endet am 12\.10\.2026/)
  assert.match(cancel.text, /nicht selbst abgegeben/)
  assert.equal(DASHES.test(cancel.text + cancel.html), false)
  const internal = buildConfirmationEmail(cancelReceipt, { outcome: 'x', internal: true })
  assert.match(internal.subject, /^Interne Kopie: /)
})

test('names for unconfirmed addresses are cut to 80 characters and stripped of links', () => {
  assert.equal(sanitizeName('  Max   Muster '), 'Max Muster')
  assert.equal(sanitizeName("Dr. Anna-Lena O'Neil Müller"), "Dr. Anna-Lena O'Neil Müller")
  assert.equal(sanitizeName('Max https://evil.example/pfad?x=1 Muster'), 'Max Muster')
  assert.equal(sanitizeName('Jetzt www.gewinn.de besuchen'), 'Jetzt besuchen')
  assert.equal(sanitizeName('Gewinn unter evil.com/abc'), 'Gewinn unter')
  assert.equal(sanitizeName('Schreib an max@evil.de'), 'Schreib an')
  assert.equal(sanitizeName('evil[.]com und hxxp://evil.com'), 'und')
  assert.equal(sanitizeName('ｅｖｉｌ．ｃｏｍ Max'), 'Max')
  assert.equal(sanitizeName('evil​.com Max'), 'Max')
  assert.equal(sanitizeName('<a href="https://x.y">Klick</a> 0800 123456'), 'Klick')
  assert.equal(sanitizeName('Max\nMuster'), 'Max Muster')
  assert.equal(Array.from(sanitizeName('Ä'.repeat(200))).length, 80)
  assert.equal(sanitizeName('https://evil.example'), '')
  assert.equal(sanitizeName(null), '')
  // Getarnt mit Kombinationszeichen oder doppeltem Punkt
  assert.equal(sanitizeName('evil.c\u0338om Max'), 'Max')
  assert.equal(sanitizeName('evil..com Max'), 'Max')
  assert.equal(sanitizeName('Nguyễn Văn An'), 'Nguyễn Văn An')
})

test('links in free text are defanged in the full confirmation, dates and names stay unchanged', () => {
  assert.equal(defangLinks('Login unter https://a.b/@x.y bitte'), 'Login unter https[:]//a[.]b/@x[.]y bitte')
  assert.equal(defangLinks('www.evil.com'), 'www[.]evil[.]com')
  assert.equal(defangLinks('an x@evil.co.uk'), 'an x@evil[.]co[.]uk')
  assert.equal(defangLinks('Kein Zugang seit 01.09.2026, siehe Ticket 42.'), 'Kein Zugang seit 01.09.2026, siehe Ticket 42.')
  assert.equal(defangLinks('Dr. med. Hans Meier'), 'Dr. med. Hans Meier')

  const data = parseKuendigung({ ...validKuendigung, kind: 'ausserordentlich', reason: 'Konto gesperrt, bitte unter https://evil.example/login bestätigen', name: 'Max evil.example' }, NOW).data
  const receipt = buildCancellationReceipt({ id: 'K-4', receivedAt: NOW, data })
  const mail = buildConfirmationEmail(receipt, { outcome: 'Ihr Vertrag endet am 12.10.2026.' })
  const all = mail.text + mail.html
  assert.equal(all.includes('evil.example'), false)
  assert.match(mail.text, /Kündigungsgrund: Konto gesperrt, bitte unter https\[:\]\/\/evil\[\.\]example\/login bestätigen/)
  assert.match(mail.text, /Name: Max evil\[\.\]example/)
  assert.match(mail.text, /mit \[\.\] statt Punkt/)
  // Die eigene Kontoadresse bleibt, wie sie ist.
  assert.match(mail.text, /E-Mail-Adresse des Kontos: max@example\.de/)
  // Die Seite (und die Datei zum Speichern) zeigt die Angaben unverändert.
  assert.match(receiptToText(receipt), /https:\/\/evil\.example\/login/)
  // Ohne Links kein Hinweis.
  const plain = buildConfirmationEmail(buildCancellationReceipt({ id: 'K-5', receivedAt: NOW, data: parseKuendigung(validKuendigung, NOW).data }), { outcome: 'x' })
  assert.equal(plain.text.includes('statt Punkt'), false)
})

test('the neutral receipt carries no contract information and no free text besides the cleaned name', () => {
  const spam = 'Kredit sofort auf https://spam.example und spam.example'
  const mail = buildNeutralEmail({
    type: 'kuendigung',
    id: 'K-260925-ABCDEF',
    receivedAt: NOW,
    name: 'Max https://spam.example Muster',
    contract: 'mentorship_stripe',
    kind: 'ausserordentlich',
    timing: 'datum',
    requestedDate: '2026-10-01',
    // Diese Felder darf die neutrale Mail nie enthalten, auch wenn sie übergeben werden.
    reason: spam,
    accountEmail: 'opfer@example.de',
    details: spam,
  })
  const all = mail.subject + mail.text + mail.html
  for (const forbidden of ['spam.example', 'Kredit', 'opfer@example.de', 'endet am', 'spätestens', 'bereits zum', 'Stripe-Abo']) {
    assert.equal(all.includes(forbidden), false, forbidden)
  }
  assert.match(mail.text, /Name \(wie angegeben\): Max Muster\n/)
  assert.match(mail.text, /Eingangs-ID: K-260925-ABCDEF/)
  assert.match(mail.text, /Eingang: 25\.09\.2026 um 14:00:00 Uhr \(MESZ\)/)
  assert.match(mail.text, /Gewünschtes Vertragsende: zum 01\.10\.2026/)
  assert.ok(mail.text.includes(CANCELLATION_NOTICE))
  assert.equal(DASHES.test(all), false)

  // Unbekannte Werte aus Auswahllisten werden weggelassen statt als Text übernommen.
  const odd = buildNeutralEmail({ type: 'widerruf', id: 'W-1', receivedAt: NOW, name: 'Erika', contract: 'https://evil.example', kind: 'x' })
  assert.equal((odd.text + odd.html).includes('evil.example'), false)
  assert.match(odd.subject, /Widerrufs \(W-1\)$/)
})

test('status notes for Petar contain no dashes and cover every decision reason', () => {
  for (const reason of ['period_end', 'cancel_at_period_end', 'cancel_at', 'paypal', 'no_subscription', 'multiple_subscriptions', 'no_period_end', 'period_end_passed', 'requested_date_after_period_end', 'cancel_at_after_period_end', 'stripe_error', 'limit']) {
    assert.ok(STATUS_NOTE_TEXT[reason], reason)
  }
  assert.equal(Object.values(STATUS_NOTE_TEXT).some((value) => DASHES.test(value)), false)
})

test('rate limiter blocks after the limit and resets after the window', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2 })
  assert.equal(limiter.consume('ip', 0).limited, false)
  assert.equal(limiter.consume('ip', 10).limited, false)
  const blocked = limiter.consume('ip', 20)
  assert.equal(blocked.limited, true)
  assert.equal(blocked.retryAfterSeconds, 1)
  assert.equal(limiter.consume('other', 20).limited, false)
  assert.equal(limiter.consume('ip', 1000).limited, false)
})
