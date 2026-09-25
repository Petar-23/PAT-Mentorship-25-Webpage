'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { CONTACT_EMAIL, LABELS } from '@/lib/vertrag-erklaerung.mjs'
import { ContractSelect, Field, describedBy, fieldClass, useDeclarationSubmit } from '@/components/vertrag/form-parts'
import { ReceiptView } from '@/components/vertrag/receipt-view'
import { cn } from '@/lib/utils'

// Widerrufsfunktion nach § 356a BGB: Name, Angaben zum Vertrag und E-Mail für die
// Eingangsbestätigung, dann die Bestätigungsfunktion exakt "Widerruf bestätigen".
// ANWALTLICH PRÜFEN: Wortlaut der Seite und Ablauf.

const PREFIX = 'widerruf'

type FormState = {
  name: string
  email: string
  contract: string
  details: string
}

const INITIAL: FormState = { name: '', email: '', contract: '', details: '' }

export function WiderrufForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const { submit, submitting, errors, formError, result, clearError } = useDeclarationSubmit('/api/vertrag/widerrufen', PREFIX)

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
      <h1 className="text-3xl font-bold mb-4">Vertrag widerrufen</h1>
      <p className="text-gray-600 mb-4">
        Hier können Sie einen Vertrag widerrufen, den Sie bei uns online geschlossen haben. Eine Anmeldung ist dafür
        nicht nötig. Nach dem Absenden sehen Sie sofort eine Bestätigung mit Datum und Uhrzeit des Eingangs und erhalten
        sie zusätzlich per E-Mail.
      </p>
      <p className="text-gray-600 mb-8">
        Alles zu Frist und Folgen des Widerrufs steht in unserer{' '}
        <Link href="/Widerruf" className="text-blue-600 underline hover:text-blue-700">
          Widerrufsbelehrung
        </Link>
        .
      </p>

      <form onSubmit={onSubmit} className="space-y-6" aria-describedby={formError ? `${PREFIX}-form-error` : undefined}>
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
          id={id('email')}
          label="E-Mail-Adresse"
          hint="Mit dieser Adresse haben Sie bestellt. An sie senden wir die Eingangsbestätigung."
          error={errors.email}
        >
          <input
            id={id('email')}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={form.email}
            onChange={(event) => set('email')(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy(id('email'), { hint: true, error: errors.email })}
            className={cn(fieldClass, 'h-10')}
          />
        </Field>
        <ContractSelect
          id={id('contract')}
          label="Welchen Vertrag möchten Sie widerrufen?"
          value={form.contract}
          error={errors.contract}
          onChange={set('contract')}
        />
        <Field
          id={id('details')}
          label="Weitere Angaben zum Vertrag (optional)"
          hint="Zum Beispiel Bestelldatum oder Rechnungsnummer."
          error={errors.details}
        >
          <textarea
            id={id('details')}
            name="details"
            rows={3}
            maxLength={1000}
            value={form.details}
            onChange={(event) => set('details')(event.target.value)}
            aria-invalid={errors.details ? true : undefined}
            aria-describedby={describedBy(id('details'), { hint: true, error: errors.details })}
            className={cn(fieldClass, 'min-h-[80px]')}
          />
        </Field>

        <div className="space-y-4 border-t border-gray-200 pt-6">
          {formError ? (
            <p id={`${PREFIX}-form-error`} role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting || undefined} className="w-full text-base sm:w-auto">
            {LABELS.withdrawConfirm}
          </Button>
          <p className="text-sm text-gray-600" aria-live="polite">
            {submitting
              ? 'Ihr Widerruf wird übermittelt.'
              : `Sie können den Widerruf weiterhin auch per E-Mail an ${CONTACT_EMAIL} erklären.`}
          </p>
        </div>
      </form>
    </div>
  )
}
