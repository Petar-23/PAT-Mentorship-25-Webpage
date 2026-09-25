import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LIMITS,
  IP_HASH_RETENTION_MS,
  acceptKuendigung,
  acceptWiderruf,
  cancellationContractEmails,
  contractEmailsOf,
  decideRecipients,
  earlyNeutralRecipient,
  evaluateLimits,
} from './vertrag-ablauf.mjs'
import { CANCELLATION_NOTICE, STATUS_NOTE_TEXT, WITHDRAWAL_NOTICE, decideCancellation } from './vertrag-erklaerung.mjs'
import { parseKuendigung, parseWiderruf } from './vertrag-validierung.mjs'

const NOW = new Date('2026-09-25T12:00:00Z')
const DASHES = /[\u2013\u2014]/
const priceConfig = { mentorshipPriceIds: ['price_m26'], raidmapPriceIds: ['price_rm_month'] }
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
  contactEmails: ['max@example.de'],
  ...overrides,
})

const SPAM = 'Kredit sofort unter https://spam.example'
// So steht SPAM in der vollständigen Bestätigung: Inhalt vollständig, Link nicht anklickbar.
const SPAM_DEFANGED = 'Kredit sofort unter https[:]//spam[.]example'
const kuendigung = (overrides = {}) =>
  parseKuendigung(
    {
      kind: 'ordentlich',
      reason: '',
      name: 'Max Muster',
      accountEmail: 'max@example.de',
      contract: 'mentorship_stripe',
      timing: 'naechstmoeglich',
      requestedDate: '',
      confirmationEmail: '',
      ...overrides,
    },
    NOW
  ).data

function makeDeps(options = {}) {
  const calls = { save: [], update: [], count: [], find: [], paypal: [], schedule: [], mails: [], notify: [], purge: [], order: [] }
  const deps = {
    now: () => new Date(NOW),
    randomBytes: () => Uint8Array.from([1, 2, 3, 4, 5, 6]),
    priceConfig,
    internalCopyEmail: 'kopie@pat.test',
    saveDeclaration: async (record) => {
      calls.save.push(record)
      return options.saved ?? true
    },
    updateDeclaration: async (id, data) => {
      calls.update.push({ id, ...data })
    },
    countRecent: async (query) => {
      calls.count.push(query)
      if (options.countError) throw options.countError
      return options.counts ?? { emailCounts: query.emails.map(() => 0), ipCount: 0, totalCount: 0 }
    },
    purgeIpHashes: async (before) => {
      calls.purge.push(before)
    },
    findSubscriptions:
      options.findSubscriptions ??
      (async (email, contract, mode) => {
        calls.order.push('find')
        calls.find.push({ email, contract, mode })
        return options.subscriptions ?? []
      }),
    findPayPalContacts: options.payPalContacts
      ? async (email) => {
          calls.paypal.push(email)
          return options.payPalContacts
        }
      : undefined,
    scheduleCancellation: async (subscriptionId, declarationId) => {
      calls.schedule.push({ subscriptionId, declarationId })
      return new Date('2026-10-12T09:30:00Z')
    },
    sendMail: async (to, mail, mailOptions) => {
      calls.order.push(`mail:${to}`)
      calls.mails.push({ to, mail, options: mailOptions })
      return options.sendOk ?? true
    },
    notify: async (lines) => {
      calls.notify.push(lines)
    },
    stripeBudgetMs: options.stripeBudgetMs,
    log: { error() {}, warn() {} },
  }
  return { deps, calls }
}

const mailTo = (calls, to) => calls.mails.filter((call) => call.to === to)
const allText = (mail) => mail.subject + mail.text + mail.html

function assertNoPersonalData(lines, values) {
  const text = lines.join('\n')
  for (const value of values) assert.equal(text.toLowerCase().includes(value.toLowerCase()), false, value)
}

// ---------------------------------------------------------------------------
// Gleiche Antwort mit und ohne Treffer
// ---------------------------------------------------------------------------

test('the response is identical whether or not a contract exists, and no Stripe call happens before it', async () => {
  const data = kuendigung({ kind: 'ausserordentlich', reason: 'Leistung fällt aus', confirmationEmail: 'andere@example.de' })
  const member = makeDeps({ subscriptions: [sub()] })
  const stranger = makeDeps({ subscriptions: [] })

  const withHit = await acceptKuendigung(data, { ipHash: 'h1' }, member.deps)
  const withoutHit = await acceptKuendigung(data, { ipHash: 'h1' }, stranger.deps)

  assert.deepEqual(withHit.body, withoutHit.body)
  assert.deepEqual(Object.keys(withHit.body).sort(), ['ok', 'receipt'])
  assert.equal(withHit.body.receipt.notice, CANCELLATION_NOTICE)
  const json = JSON.stringify(withHit.body)
  for (const leak of ['endsAt', 'emailSent', 'endet am', 'spätestens', '12.10.2026', 'Stripe-Abo', 'status', 'sub_1']) {
    assert.equal(json.includes(leak), false, leak)
  }
  // Vor der Antwort nur Speichern: keine Stripe-Suche, kein Limit, keine Mail.
  for (const { calls } of [member, stranger]) {
    assert.equal(calls.find.length, 0)
    assert.equal(calls.count.length, 0)
    assert.equal(calls.mails.length, 0)
    assert.equal(calls.save.length, 1)
    assert.equal(calls.save[0].ipHash, 'h1')
    assert.equal(calls.save[0].status, 'received')
  }

  await withHit.background()
  await withoutHit.background()
  assert.equal(member.calls.find.length, 1)
  assert.equal(stranger.calls.find.length, 1)
})

test('the withdrawal response is identical whether or not a contract exists', async () => {
  const data = parseWiderruf({ name: 'Erika Muster', email: 'erika@example.de', contract: 'raidmap', details: SPAM }).data
  const member = makeDeps({ subscriptions: [sub({ status: 'canceled', product: 'raidmap', priceIds: ['price_rm_month'], contactEmails: ['erika@example.de'] })] })
  const stranger = makeDeps()
  const a = await acceptWiderruf(data, { ipHash: null }, member.deps)
  const b = await acceptWiderruf(data, { ipHash: null }, stranger.deps)
  assert.deepEqual(a.body, b.body)
  assert.equal(a.body.receipt.notice, WITHDRAWAL_NOTICE)
  assert.equal(member.calls.find.length + stranger.calls.find.length, 0)
})

// ---------------------------------------------------------------------------
// Empfänger
// ---------------------------------------------------------------------------

test('recipient decision: full confirmation only to a stored address, neutral receipt otherwise', () => {
  // Treffer, keine abweichende Adresse
  assert.deepEqual(decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: 'max@example.de', contractEmails: ['max@example.de'] }), {
    full: 'max@example.de',
    neutral: null,
  })
  // Treffer, abweichende Bestätigungsadresse: nur neutral dorthin
  assert.deepEqual(decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: 'fremd@example.de', contractEmails: ['max@example.de'] }), {
    full: 'max@example.de',
    neutral: 'fremd@example.de',
  })
  // Auch eine abweichende Adresse, die selbst hinterlegt ist, bekommt nur die neutrale Mail: Sie geht
  // vor der Stripe-Suche raus. Die vollständige Bestätigung geht an die Kontoadresse.
  assert.deepEqual(
    decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: 'Max.Stripe@Example.de', contractEmails: ['max@example.de', 'max.stripe@example.de'] }),
    { full: 'max@example.de', neutral: 'max.stripe@example.de' }
  )
  assert.equal(earlyNeutralRecipient({ accountEmail: 'max@example.de', confirmationEmail: 'MAX@example.de' }), null)
  assert.equal(earlyNeutralRecipient({ accountEmail: 'max@example.de', confirmationEmail: '' }), null)
  assert.equal(earlyNeutralRecipient({ accountEmail: 'max@example.de', confirmationEmail: 'Fremd@example.de' }), 'fremd@example.de')
  // Kein Treffer: neutral an die angegebene Adresse, keine vollständige Bestätigung
  assert.deepEqual(decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: 'fremd@example.de', contractEmails: [] }), {
    full: null,
    neutral: 'fremd@example.de',
  })
  assert.deepEqual(decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: '', contractEmails: [] }), { full: null, neutral: 'max@example.de' })
  // Exakter Vergleich: Teiltreffer zählen nicht
  assert.deepEqual(decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: 'anna.max@example.de', contractEmails: ['max@example.de'] }), {
    full: 'max@example.de',
    neutral: 'anna.max@example.de',
  })
  // Hinterlegt ist nur eine andere Adresse: die vollständige Bestätigung geht nur dorthin
  assert.deepEqual(decideRecipients({ accountEmail: 'max@example.de', confirmationEmail: 'max@example.de', contractEmails: ['neu@example.de'] }), {
    full: 'neu@example.de',
    neutral: 'max@example.de',
  })
})

test('stored addresses come only from the subscription the cancellation affects', () => {
  const subs = [
    sub({ id: 'sub_a', contactEmails: ['A@example.de', 'a@example.de'] }),
    sub({ id: 'sub_old', status: 'canceled', contactEmails: ['old@example.de'] }),
  ]
  assert.deepEqual(contractEmailsOf(subs), ['a@example.de', 'old@example.de'])
  const base = { contract: 'mentorship_stripe', kind: 'ordentlich', timing: 'naechstmoeglich', requestedDate: null, priceConfig, now: NOW }
  const decision = decideCancellation({ ...base, subscriptions: subs })
  assert.deepEqual(cancellationContractEmails(decision, subs, 'mentorship_stripe', priceConfig), ['a@example.de'])
  const none = decideCancellation({ ...base, subscriptions: [subs[1]] })
  assert.deepEqual(cancellationContractEmails(none, [subs[1]], 'mentorship_stripe', priceConfig), [])
  const paypal = decideCancellation({ ...base, contract: 'mentorship_paypal', subscriptions: [] })
  assert.deepEqual(cancellationContractEmails(paypal, [], 'mentorship_paypal', priceConfig), [])
})

test('member found: the stored address gets the full confirmation with contract end, the other address only a neutral receipt', async () => {
  const data = kuendigung({ kind: 'ausserordentlich', reason: SPAM, name: 'Max https://spam.example Muster', confirmationEmail: 'angreifer@example.de' })
  const { deps, calls } = makeDeps({ subscriptions: [sub()] })
  const accepted = await acceptKuendigung(data, { ipHash: 'h1' }, deps)
  await accepted.background()

  assert.deepEqual(calls.schedule, [{ subscriptionId: 'sub_1', declarationId: accepted.body.receipt.id }])
  const full = mailTo(calls, 'max@example.de')
  assert.equal(full.length, 1)
  assert.equal(full[0].options.bcc, true)
  assert.match(full[0].mail.text, /spätestens am 12\.10\.2026/)
  assert.ok(full[0].mail.text.includes(SPAM_DEFANGED), 'the stored address sees the full declaration')
  assert.equal(allText(full[0].mail).includes('https://spam.example'), false, 'links from the form are not clickable')
  assert.match(full[0].mail.text, /mit \[\.\] statt Punkt/)

  const neutral = mailTo(calls, 'angreifer@example.de')
  assert.equal(neutral.length, 1)
  assert.equal(neutral[0].options.bcc, false)
  const neutralText = allText(neutral[0].mail)
  for (const forbidden of ['12.10.2026', 'spätestens', 'spam.example', 'Kredit', 'max@example.de', 'Stripe-Abo']) {
    assert.equal(neutralText.includes(forbidden), false, forbidden)
  }
  assert.match(neutral[0].mail.text, /Name \(wie angegeben\): Max Muster\n/)
  assert.equal(mailTo(calls, 'kopie@pat.test').length, 0)
  assert.equal(calls.mails.length, 2)

  const update = calls.update.at(-1)
  assert.equal(update.status, 'scheduled')
  assert.ok(update.confirmationSentAt instanceof Date)
  assert.equal(update.endsAt.toISOString(), '2026-10-12T09:30:00.000Z')
  assert.match(update.mailNote, /vollständige Bestätigung an hinterlegte Adresse versendet; neutrale Eingangsbestätigung/)
  assert.equal(update.mailNote.includes('@'), false)
  assertNoPersonalData(calls.notify[0], ['max@example.de', 'angreifer@example.de', 'Max', 'Muster', 'spam.example'])
  assert.equal(calls.purge[0].getTime(), NOW.getTime() - IP_HASH_RETENTION_MS)
})

test('no contract found: neutral receipt to the given address, full version only to Petar, manual handling', async () => {
  const data = kuendigung({ name: 'Anna https://spam.example', accountEmail: 'opfer@example.de' })
  const { deps, calls } = makeDeps({ subscriptions: [] })
  const accepted = await acceptKuendigung(data, { ipHash: 'h1' }, deps)
  await accepted.background()

  assert.equal(calls.schedule.length, 0)
  assert.deepEqual(calls.mails.map((call) => call.to).sort(), ['kopie@pat.test', 'opfer@example.de'])
  const neutral = mailTo(calls, 'opfer@example.de')[0]
  assert.equal(neutral.options.bcc, false)
  assert.equal(allText(neutral.mail).includes('spam.example'), false)
  assert.ok(neutral.mail.text.includes(CANCELLATION_NOTICE))
  const internal = mailTo(calls, 'kopie@pat.test')[0]
  assert.match(internal.mail.subject, /^Interne Kopie: /)

  const update = calls.update.at(-1)
  assert.equal(update.status, 'manual')
  assert.equal(update.confirmationSentAt, null)
  assert.match(update.mailNote, /keine hinterlegte Adresse gefunden/)
  const lines = calls.notify[0]
  assert.ok(lines.includes('Handlung nötig: ja'))
  assert.ok(lines.some((line) => line.includes(STATUS_NOTE_TEXT.no_subscription)))
  assertNoPersonalData(lines, ['opfer@example.de', 'Anna', 'spam.example'])
})

test('paypal cancellations never touch Stripe and get the neutral receipt when the address is not in the PayPal list', async () => {
  const { deps, calls } = makeDeps({ subscriptions: [sub()] })
  const accepted = await acceptKuendigung(kuendigung({ contract: 'mentorship_paypal' }), { ipHash: null }, deps)
  await accepted.background()
  assert.equal(calls.find.length, 0)
  assert.equal(calls.schedule.length, 0)
  assert.deepEqual(calls.mails.map((call) => call.to).sort(), ['kopie@pat.test', 'max@example.de'])
  assert.equal(mailTo(calls, 'max@example.de')[0].options.tag, 'vertrag-kuendigung-eingang')
  // Die neutrale Mail an die eigene Adresse nennt diese Adresse (Inhalt der Erklärung).
  assert.match(mailTo(calls, 'max@example.de')[0].mail.text, /Angegebene E-Mail-Adresse: max@example\.de/)
})

test('paypal cancellation: an address from the PayPal list gets the full confirmation, still manual in PayPal', async () => {
  const { deps, calls } = makeDeps({ payPalContacts: ['max@example.de', 'max.paypal@example.de'] })
  const accepted = await acceptKuendigung(kuendigung({ contract: 'mentorship_paypal' }), { ipHash: null }, deps)
  await accepted.background()
  assert.deepEqual(calls.paypal, ['max@example.de'])
  assert.equal(calls.find.length, 0)
  assert.equal(calls.schedule.length, 0)
  assert.deepEqual(calls.mails.map((call) => call.to), ['max@example.de'])
  const full = calls.mails[0]
  assert.equal(full.options.tag, 'vertrag-kuendigung')
  assert.equal(full.options.bcc, true)
  assert.match(full.mail.text, /gesondert per E-Mail/)
  const update = calls.update.at(-1)
  assert.equal(update.status, 'manual')
  assert.equal(update.statusNote, STATUS_NOTE_TEXT.paypal)
  assert.ok(update.confirmationSentAt instanceof Date)
  assert.ok(calls.notify[0].includes('Handlung nötig: ja'))
})

test('a failing PayPal lookup falls back to the neutral receipt and the internal copy', async () => {
  const { deps, calls } = makeDeps()
  deps.findPayPalContacts = async () => {
    throw new Error('db down')
  }
  await (await acceptKuendigung(kuendigung({ contract: 'mentorship_paypal' }), { ipHash: null }, deps)).background()
  assert.deepEqual(calls.mails.map((call) => call.to).sort(), ['kopie@pat.test', 'max@example.de'])
})

test('a Stripe timeout changes nothing in Stripe afterwards and ends in manual handling', async () => {
  let release
  const { deps, calls } = makeDeps({
    stripeBudgetMs: 20,
    findSubscriptions: () => new Promise((resolve) => (release = () => resolve([sub()]))),
  })
  const accepted = await acceptKuendigung(kuendigung(), { ipHash: null }, deps)
  await accepted.background()
  release()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(calls.schedule.length, 0)
  assert.equal(calls.update.at(-1).statusNote, STATUS_NOTE_TEXT.stripe_error)
  assert.equal(mailTo(calls, 'max@example.de')[0].options.tag, 'vertrag-kuendigung-eingang')
})

test('withdrawal: full text only to a stored address, otherwise a neutral receipt without the free text', async () => {
  const data = parseWiderruf({ name: 'Erika Muster', email: 'erika@example.de', contract: 'raidmap', details: SPAM }).data
  const member = makeDeps({ subscriptions: [sub({ status: 'canceled', product: 'raidmap', priceIds: ['price_rm_month'], contactEmails: ['erika@example.de'] })] })
  await (await acceptWiderruf(data, { ipHash: null }, member.deps)).background()
  assert.deepEqual(member.calls.find, [{ email: 'erika@example.de', contract: 'raidmap', mode: 'any' }])
  assert.equal(member.calls.mails.length, 1)
  assert.ok(member.calls.mails[0].mail.text.includes(SPAM_DEFANGED))
  assert.equal(member.calls.mails[0].options.bcc, true)

  const stranger = makeDeps()
  await (await acceptWiderruf(data, { ipHash: null }, stranger.deps)).background()
  const neutral = mailTo(stranger.calls, 'erika@example.de')[0]
  assert.equal(allText(neutral.mail).includes('spam.example'), false)
  assert.equal(allText(neutral.mail).includes('Kredit'), false)
  assert.match(neutral.mail.text, /Hiermit widerrufe ich/)
  assert.match(neutral.mail.text, /Eingang: 25\.09\.2026 um 14:00:00 Uhr/)
  assert.equal(mailTo(stranger.calls, 'kopie@pat.test').length, 1)
  assertNoPersonalData(stranger.calls.notify[0], ['erika@example.de', 'Erika', 'spam.example'])
  for (const { calls } of [member, stranger]) {
    for (const call of calls.mails) assert.equal(DASHES.test(allText(call.mail)), false)
  }
})

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

test('limits: at most 3 declarations per email address and 20 per IP hash in 24 hours, Telegram only on the first excess', () => {
  assert.equal(LIMITS.windowMs, 24 * 60 * 60 * 1000)
  const noCap = { dailyCap: false, dailyCapStarted: false }
  assert.deepEqual(evaluateLimits({ emailCounts: [3, 1], ipCount: 20 }), { limited: false, reasons: [], notify: false, ...noCap })
  assert.deepEqual(evaluateLimits({ emailCounts: [1, 4], ipCount: 2 }), { limited: true, reasons: ['email'], notify: true, ...noCap })
  assert.deepEqual(evaluateLimits({ emailCounts: [5], ipCount: 2 }), { limited: true, reasons: ['email'], notify: false, ...noCap })
  assert.deepEqual(evaluateLimits({ emailCounts: [1], ipCount: 21 }), { limited: true, reasons: ['ip'], notify: true, ...noCap })
  assert.deepEqual(evaluateLimits({ emailCounts: [6], ipCount: 30 }), { limited: true, reasons: ['email', 'ip'], notify: false, ...noCap })
  assert.deepEqual(evaluateLimits({ emailCounts: [1], ipCount: null }), { limited: false, reasons: [], notify: false, ...noCap })
  assert.deepEqual(evaluateLimits(null), { limited: false, reasons: [], notify: false, ...noCap })
  // Tageslimit für alle Erklärungen zusammen: nur beim Überschreiten eine Meldung.
  assert.equal(LIMITS.maxPerDay, 30)
  assert.deepEqual(evaluateLimits({ emailCounts: [1], ipCount: 1, totalCount: 30 }), { limited: false, reasons: [], notify: false, ...noCap })
  assert.deepEqual(evaluateLimits({ emailCounts: [1], ipCount: 1, totalCount: 31 }), { limited: false, reasons: [], notify: false, dailyCap: true, dailyCapStarted: true })
  assert.deepEqual(evaluateLimits({ emailCounts: [1], ipCount: 1, totalCount: 90 }), { limited: false, reasons: [], notify: false, dailyCap: true, dailyCapStarted: false })
})

test('over the limit: same confirmation on screen, no mail, no Stripe, Petar informed without personal data', async () => {
  const data = kuendigung({ name: 'Max Muster', confirmationEmail: 'Andere@Example.de' })
  const normal = makeDeps({ subscriptions: [sub()] })
  // Drei frühere Erklärungen zur Kontoadresse: Diese ist die vierte.
  const limited = makeDeps({ subscriptions: [sub()], counts: { emailCounts: [3, 0], ipCount: 0 } })

  const a = await acceptKuendigung(data, { ipHash: 'h1' }, normal.deps)
  const b = await acceptKuendigung(data, { ipHash: 'h1' }, limited.deps)
  assert.deepEqual(a.body, b.body)
  await b.background()

  assert.equal(limited.calls.mails.length, 0)
  assert.equal(limited.calls.find.length, 0)
  assert.equal(limited.calls.schedule.length, 0)
  const query = limited.calls.count[0]
  assert.deepEqual(query.emails, ['max@example.de', 'andere@example.de'])
  assert.equal(query.ipHash, 'h1')
  assert.equal(query.since.getTime(), NOW.getTime() - LIMITS.windowMs)
  assert.equal(query.before.getTime(), NOW.getTime())
  const update = limited.calls.update.at(-1)
  assert.equal(update.status, 'manual')
  assert.equal(update.statusNote, STATUS_NOTE_TEXT.limit)
  assert.equal(limited.calls.notify.length, 1)
  assert.ok(limited.calls.notify[0].some((line) => line.includes('mehr als 3 Erklärungen zu einer E-Mail-Adresse')))
  assertNoPersonalData(limited.calls.notify[0], ['max@example.de', 'andere@example.de', 'Max', 'Muster', 'h1'])

  // Weitere Eingänge über dem Limit: keine Mail und keine weitere Telegram-Meldung.
  const again = makeDeps({ counts: { emailCounts: [4, 0], ipCount: 0 } })
  await (await acceptKuendigung(data, { ipHash: 'h1' }, again.deps)).background()
  assert.equal(again.calls.mails.length, 0)
  assert.equal(again.calls.notify.length, 0)
  assert.equal(again.calls.update.at(-1).statusNote, STATUS_NOTE_TEXT.limit)
})

test('the IP limit also blocks mails for withdrawals', async () => {
  const data = parseWiderruf({ name: 'Erika', email: 'erika@example.de', contract: 'raidmap' }).data
  const { deps, calls } = makeDeps({ counts: { emailCounts: [0], ipCount: 20 } })
  await (await acceptWiderruf(data, { ipHash: 'h2' }, deps)).background()
  assert.equal(calls.mails.length, 0)
  assert.equal(calls.notify.length, 1)
  assert.ok(calls.notify[0].some((line) => line.includes('mehr als 20 Erklärungen von einer IP-Adresse')))
})

test('if the declaration could not be saved, it still counts toward the limit', async () => {
  const { deps, calls } = makeDeps({ saved: false, counts: { emailCounts: [3], ipCount: 0 } })
  await (await acceptKuendigung(kuendigung(), { ipHash: null }, deps)).background()
  assert.equal(calls.mails.length, 0)
  assert.equal(calls.update.length, 0)
  // Ohne gespeicherten Datensatz meldet Telegram immer, die Daten stehen nur im Server-Log.
  assert.equal(calls.notify.length, 1)
})

test('if the limit check fails, the declaration is processed normally (the in-memory limit still applies)', async () => {
  const { deps, calls } = makeDeps({ subscriptions: [sub()], countError: new Error('db down') })
  await (await acceptKuendigung(kuendigung(), { ipHash: 'h1' }, deps)).background()
  assert.equal(calls.schedule.length, 1)
  assert.equal(mailTo(calls, 'max@example.de').length, 1)
})

// ---------------------------------------------------------------------------
// Kein Rückschluss über Zeitpunkt oder Inhalt der E-Mail an eine abweichende Adresse
// ---------------------------------------------------------------------------

test('the other address gets its neutral receipt before any Stripe lookup, identical for members and strangers', async () => {
  const data = kuendigung({ accountEmail: 'opfer@example.de', confirmationEmail: 'angreifer@example.de' })
  const member = makeDeps({ subscriptions: [sub({ contactEmails: ['opfer@example.de'] })] })
  const stranger = makeDeps({ subscriptions: [] })
  await (await acceptKuendigung(data, { ipHash: 'h1' }, member.deps)).background()
  await (await acceptKuendigung(data, { ipHash: 'h1' }, stranger.deps)).background()

  for (const { calls } of [member, stranger]) {
    assert.deepEqual(calls.order.slice(0, 2), ['mail:angreifer@example.de', 'find'])
  }
  const a = mailTo(member.calls, 'angreifer@example.de')
  const b = mailTo(stranger.calls, 'angreifer@example.de')
  assert.equal(a.length, 1)
  assert.equal(b.length, 1)
  assert.deepEqual(a[0].mail, b[0].mail)
  assert.deepEqual(a[0].options, b[0].options)
  // Die neutrale Mail an die abweichende Adresse nennt nur diese Adresse, nie die Kontoadresse.
  assert.equal(allText(a[0].mail).includes('opfer@example.de'), false)
  assert.match(a[0].mail.text, /Angegebene E-Mail-Adresse: angreifer@example\.de/)
  // Mitglied: vollständige Bestätigung an die hinterlegte Kontoadresse. Fremder: nichts an die Kontoadresse.
  assert.equal(mailTo(member.calls, 'opfer@example.de').length, 1)
  assert.equal(mailTo(stranger.calls, 'opfer@example.de').length, 0)
})

// ---------------------------------------------------------------------------
// Tageslimit gegen Angriffe über wechselnde IPs und Adressen
// ---------------------------------------------------------------------------

test('over the daily cap: no mail to unconfirmed addresses, no internal copy, one Telegram message at the crossing', async () => {
  const data = kuendigung({ accountEmail: 'zufall1@example.de', confirmationEmail: 'zufall2@example.de' })

  const crossing = makeDeps({ counts: { emailCounts: [0, 0], ipCount: 0, totalCount: LIMITS.maxPerDay } })
  await (await acceptKuendigung(data, { ipHash: 'h9' }, crossing.deps)).background()
  assert.equal(crossing.calls.mails.length, 0)
  assert.equal(crossing.calls.notify.length, 1)
  assert.ok(crossing.calls.notify[0].some((line) => line.startsWith('Tageslimit erreicht')))
  assertNoPersonalData(crossing.calls.notify[0], ['zufall1@example.de', 'zufall2@example.de', 'Max', 'Muster'])
  const update = crossing.calls.update.at(-1)
  assert.equal(update.status, 'manual')
  assert.match(update.mailNote, /nicht versendet \(Tageslimit erreicht\)/)

  const after = makeDeps({ counts: { emailCounts: [0, 0], ipCount: 0, totalCount: LIMITS.maxPerDay + 7 } })
  await (await acceptKuendigung(data, { ipHash: 'h10' }, after.deps)).background()
  assert.equal(after.calls.mails.length, 0)
  assert.equal(after.calls.notify.length, 0)

  const widerruf = parseWiderruf({ name: 'Erika', email: 'zufall3@example.de', contract: 'raidmap' }).data
  const w = makeDeps({ counts: { emailCounts: [0], ipCount: 0, totalCount: LIMITS.maxPerDay + 7 } })
  await (await acceptWiderruf(widerruf, { ipHash: 'h11' }, w.deps)).background()
  assert.equal(w.calls.mails.length, 0)
  assert.equal(w.calls.notify.length, 0)
})

test('over the daily cap a real member is still processed and confirmed at the stored address', async () => {
  const { deps, calls } = makeDeps({
    subscriptions: [sub()],
    counts: { emailCounts: [0, 0], ipCount: 0, totalCount: LIMITS.maxPerDay + 7 },
  })
  await (await acceptKuendigung(kuendigung({ confirmationEmail: 'andere@example.de' }), { ipHash: 'h1' }, deps)).background()
  assert.equal(calls.schedule.length, 1)
  assert.deepEqual(calls.mails.map((call) => call.to), ['max@example.de'])
  assert.equal(calls.notify.length, 1)
  assert.equal(calls.update.at(-1).status, 'scheduled')
})

// ---------------------------------------------------------------------------
// Widerruf: PayPal-Liste und eigene Adresse in der neutralen Mail
// ---------------------------------------------------------------------------

test('withdrawal of a PayPal contract uses the PayPal list for the recipient and never Stripe', async () => {
  const data = parseWiderruf({ name: 'Erika Muster', email: 'erika@example.de', contract: 'mentorship_paypal', details: 'Bestellt am 20.09.' }).data
  const listed = makeDeps({ payPalContacts: ['erika@example.de'] })
  await (await acceptWiderruf(data, { ipHash: null }, listed.deps)).background()
  assert.equal(listed.calls.find.length, 0)
  assert.deepEqual(listed.calls.mails.map((call) => call.to), ['erika@example.de'])
  assert.match(listed.calls.mails[0].mail.text, /Weitere Angaben zum Vertrag: Bestellt am 20\.09\./)

  const unlisted = makeDeps({ payPalContacts: [] })
  await (await acceptWiderruf(data, { ipHash: null }, unlisted.deps)).background()
  const neutral = mailTo(unlisted.calls, 'erika@example.de')[0]
  assert.equal(neutral.options.tag, 'vertrag-widerruf-eingang')
  assert.match(neutral.mail.text, /Angegebene E-Mail-Adresse: erika@example\.de/)
  assert.equal(neutral.mail.text.includes('Bestellt am'), false)
})

test('limit counts are positions: earlier declarations plus this one, also when saving failed', async () => {
  // Gespeichert oder nicht: gezählt wird immer "davor + 1".
  for (const saved of [true, false]) {
    const { deps, calls } = makeDeps({ saved, counts: { emailCounts: [3], ipCount: 0, totalCount: 0 } })
    await (await acceptKuendigung(kuendigung(), { ipHash: 'h1' }, deps)).background()
    assert.equal(calls.mails.length, 0, `saved=${saved}`)
    assert.equal(calls.notify.length, 1, `saved=${saved}`)
  }
  const ok = makeDeps({ counts: { emailCounts: [2], ipCount: 19, totalCount: LIMITS.maxPerDay - 1 } })
  await (await acceptKuendigung(kuendigung(), { ipHash: 'h1' }, ok.deps)).background()
  assert.equal(mailTo(ok.calls, 'max@example.de').length, 1)
})

test('the daily cap message is also sent when the crossing declaration itself is over the address limit', async () => {
  const { deps, calls } = makeDeps({ counts: { emailCounts: [4], ipCount: 0, totalCount: LIMITS.maxPerDay } })
  await (await acceptKuendigung(kuendigung(), { ipHash: 'h1' }, deps)).background()
  assert.equal(calls.mails.length, 0)
  assert.equal(calls.notify.length, 1)
  assert.ok(calls.notify[0].some((line) => line.startsWith('Tageslimit erreicht')))
})
