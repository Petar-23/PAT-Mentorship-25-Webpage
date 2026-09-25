'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { CONTACT_EMAIL, KIND_OPTIONS, LABELS, TIMING_OPTIONS, berlinDateKey } from '@/lib/vertrag-erklaerung.mjs'
import { ContractSelect, Field, FieldError, describedBy, fieldClass, useDeclarationSubmit } from '@/components/vertrag/form-parts'
import { ReceiptView } from '@/components/vertrag/receipt-view'
import { cn } from '@/lib/utils'

// Bestätigungsseite nach § 312k Abs. 2 BGB: fragt Art (und Grund), Identifizierung, Vertrag,
// Zeitpunkt und E-Mail für die Bestätigung ab. Die Bestätigungsschaltfläche trägt exakt
// "jetzt kündigen" und darf nichts anderes enthalten.
// ANWALTLICH PRÜFEN: Wortlaut der Seite und Ablauf.

const PREFIX = 'kuendigung'

type FormState = {
  kind: string
  reason: string
  name: string
  accountEmail: string
  contract: string
  timing: string
  requestedDate: string
  confirmationEmail: string
}

const INITIAL: FormState = {
  kind: 'ordentlich',
  reason: '',
  name: '',
  accountEmail: '',
  contract: '',
  timing: 'naechstmoeglich',
  requestedDate: '',
  confirmationEmail: '',
}

export function KuendigungForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const { submit, submitting, errors, formError, result, clearError } = useDeclarationSubmit('/api/vertrag/kuendigen', PREFIX)

  if (result) return <ReceiptView result={result} />

  const set = (field: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    clearError(field)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submit({ ...form })
  }

  const id = (field: keyof FormState) => `${PREFIX}-${field}`

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Vertrag kündigen</h1>
      <p className="text-gray-600 mb-8">
        Hier können Sie Ihren Vertrag mit uns ordentlich oder außerordentlich kündigen. Eine Anmeldung ist dafür nicht
        nötig. Nach dem Absenden sehen Sie sofort eine Bestätigung mit Inhalt, Datum und Uhrzeit des Eingangs zum
        Speichern. Die Bestätigung mit dem Zeitpunkt, zu dem der Vertrag endet, senden wir an die E-Mail-Adresse, die zu
        Ihrem Vertrag hinterlegt ist.
      </p>

      <form onSubmit={onSubmit} className="space-y-8" aria-describedby={formError ? `${PREFIX}-form-error` : undefined}>
        <fieldset className="space-y-3">
          <legend className="text-xl font-semibold mb-2">Art der Kündigung</legend>
          {KIND_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-3 text-gray-900">
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={form.kind === option.value}
                onChange={(event) => set('kind')(event.target.value)}
                className="mt-1 h-4 w-4 accent-slate-900"
              />
              <span>{option.label}</span>
            </label>
          ))}
          <FieldError id={`${id('kind')}-error`} message={errors.kind} />
          {form.kind === 'ausserordentlich' ? (
            <Field id={id('reason')} label="Grund der außerordentlichen Kündigung" error={errors.reason}>
              <textarea
                id={id('reason')}
                name="reason"
                required
                rows={4}
                maxLength={2000}
                value={form.reason}
                onChange={(event) => set('reason')(event.target.value)}
                aria-invalid={errors.reason ? true : undefined}
                aria-describedby={describedBy(id('reason'), { error: errors.reason })}
                className={cn(fieldClass, 'min-h-[96px]')}
              />
            </Field>
          ) : null}
        </fieldset>

        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Ihre Angaben</h2>
          <Field id={id('name')} label="Vor- und Nachname" error={errors.name}>
            <input
              id={id('name')}
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={200}
              value={form.name}
              onChange={(event) => set('name')(event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy(id('name'), { error: errors.name })}
              className={cn(fieldClass, 'h-10')}
            />
          </Field>
          <Field
            id={id('accountEmail')}
            label="E-Mail-Adresse Ihres Kontos"
            hint="Mit dieser Adresse haben Sie bestellt oder melden sich an. Daran erkennen wir Ihren Vertrag. An die zu Ihrem Vertrag hinterlegte Adresse senden wir auch die Kündigungsbestätigung."
            error={errors.accountEmail}
          >
            <input
              id={id('accountEmail')}
              name="accountEmail"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              value={form.accountEmail}
              onChange={(event) => set('accountEmail')(event.target.value)}
              aria-invalid={errors.accountEmail ? true : undefined}
              aria-describedby={describedBy(id('accountEmail'), { hint: true, error: errors.accountEmail })}
              className={cn(fieldClass, 'h-10')}
            />
          </Field>
          <ContractSelect
            id={id('contract')}
            label="Welchen Vertrag möchten Sie kündigen?"
            value={form.contract}
            error={errors.contract}
            onChange={set('contract')}
          />
        </section>

        <fieldset className="space-y-3">
          <legend className="text-xl font-semibold mb-2">Wann soll die Kündigung wirken?</legend>
          {TIMING_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-3 text-gray-900">
              <input
                type="radio"
                name="timing"
                value={option.value}
                checked={form.timing === option.value}
                onChange={(event) => set('timing')(event.target.value)}
                className="mt-1 h-4 w-4 accent-slate-900"
              />
              <span>{option.label}</span>
            </label>
          ))}
          <FieldError id={`${id('timing')}-error`} message={errors.timing} />
          {form.timing === 'datum' ? (
            <Field id={id('requestedDate')} label="Gewünschtes Datum" error={errors.requestedDate}>
              <input
                id={id('requestedDate')}
                name="requestedDate"
                type="date"
                required
                min={berlinDateKey(new Date())}
                value={form.requestedDate}
                onChange={(event) => set('requestedDate')(event.target.value)}
                aria-invalid={errors.requestedDate ? true : undefined}
                aria-describedby={describedBy(id('requestedDate'), { error: errors.requestedDate })}
                className={cn(fieldClass, 'h-10 sm:max-w-xs')}
              />
            </Field>
          ) : null}
        </fieldset>

        <Field
          id={id('confirmationEmail')}
          label="Weitere E-Mail-Adresse für eine Eingangsbestätigung (optional)"
          hint="Die Bestätigung mit dem Vertragsende senden wir zum Schutz Ihrer Daten immer an die E-Mail-Adresse, die zu Ihrem Vertrag hinterlegt ist. An eine andere Adresse, die Sie hier angeben, senden wir nur eine Eingangsbestätigung ohne Angaben zu Ihrem Vertrag."
          error={errors.confirmationEmail}
        >
          <input
            id={id('confirmationEmail')}
            name="confirmationEmail"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            value={form.confirmationEmail}
            onChange={(event) => set('confirmationEmail')(event.target.value)}
            aria-invalid={errors.confirmationEmail ? true : undefined}
            aria-describedby={describedBy(id('confirmationEmail'), { hint: true, error: errors.confirmationEmail })}
            className={cn(fieldClass, 'h-10')}
          />
        </Field>

        <div className="space-y-4 border-t border-gray-200 pt-6">
          {formError ? (
            <p id={`${PREFIX}-form-error`} role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting || undefined} className="w-full text-base sm:w-auto">
            {LABELS.cancelConfirm}
          </Button>
          <p className="text-sm text-gray-600" aria-live="polite">
            {submitting
              ? 'Ihre Kündigung wird übermittelt.'
              : `Sie können weiterhin auch per E-Mail an ${CONTACT_EMAIL} kündigen.`}
          </p>
        </div>
      </form>
    </div>
  )
}
