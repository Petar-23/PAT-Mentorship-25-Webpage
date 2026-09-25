'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { CONTACT_EMAIL, CONTRACT_OPTIONS, type Receipt } from '@/lib/vertrag-erklaerung.mjs'
import { cn } from '@/lib/utils'

// Gemeinsame Bausteine für /kuendigen und /widerrufen.
// ANWALTLICH PRÜFEN: Wortlaut und Ablauf der Formulare.

// Die API antwortet für alle Fälle gleich: nur die Bestätigung aus den eigenen Angaben.
export type DeclarationResult = {
  receipt: Receipt
}

export const fieldClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 md:text-sm aria-[invalid=true]:border-red-500'

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-gray-600">
          {hint}
        </p>
      ) : null}
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-red-700">
      {message}
    </p>
  )
}

export function describedBy(id: string, options: { hint?: boolean; error?: string }) {
  const ids = [options.hint ? `${id}-hint` : null, options.error ? `${id}-error` : null].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

export function ContractSelect({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <Field id={id} label={label} error={error}>
      <select
        id={id}
        name="contract"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { error })}
        className={cn(fieldClass, 'h-10')}
      >
        <option value="" disabled>
          Bitte auswählen
        </option>
        {CONTRACT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

const NETWORK_ERROR = `Die Übermittlung hat leider nicht geklappt. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut oder schreiben Sie an ${CONTACT_EMAIL}.`

export function useDeclarationSubmit(endpoint: string, idPrefix: string) {
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<DeclarationResult | null>(null)
  const inFlight = useRef(false)

  const clearError = useCallback((field: string) => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  const submit = useCallback(
    async (payload: Record<string, string>) => {
      if (inFlight.current) return
      inFlight.current = true
      setSubmitting(true)
      setFormError('')

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => null)

        if (response.ok && data?.receipt) {
          setErrors({})
          setResult({ receipt: data.receipt })
          return
        }

        const fieldErrors: Record<string, string> = data?.errors && typeof data.errors === 'object' ? data.errors : {}
        setErrors(fieldErrors)
        setFormError(typeof data?.error === 'string' ? data.error : NETWORK_ERROR)
        const firstField = Object.keys(fieldErrors)[0]
        if (firstField) document.getElementById(`${idPrefix}-${firstField}`)?.focus()
      } catch {
        setFormError(NETWORK_ERROR)
      } finally {
        inFlight.current = false
        setSubmitting(false)
      }
    },
    [endpoint, idPrefix]
  )

  return { submit, submitting, errors, formError, result, clearError }
}
