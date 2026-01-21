'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HeroPill } from '@/components/ui/hero-pill'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type FormState = {
  firstName: string
  email: string
}

type FieldErrors = {
  firstName?: string
  email?: string
}

type LeadMagnetSignupFormProps = {
  buttonLabel?: string
  className?: string
  idPrefix?: string
}

const WHOP_REVIEWS_URL =
  'https://whop.com/price-action-trader-mentorship-24-d9/pat-mentorship-2025/'

const isValidEmail = (value: string) => {
  const email = value.trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function LeadMagnetSignupForm({
  buttonLabel = 'Modell 22 Checkliste Jetzt Sichern',
  className,
  idPrefix = 'lead-magnet',
}: LeadMagnetSignupFormProps) {
  const searchParams = useSearchParams()
  const emailRef = useRef<HTMLInputElement | null>(null)
  const firstNameRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()

  const [form, setForm] = useState<FormState>({ firstName: '', email: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle'
  )
  const [statusMessage, setStatusMessage] = useState('')

  const handleChange =
    (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }))
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }

  const validate = () => {
    const nextErrors: FieldErrors = {}

    if (!form.firstName.trim()) {
      nextErrors.firstName = 'Bitte gib deinen Vornamen ein.'
    }

    if (!isValidEmail(form.email)) {
      nextErrors.email = 'Bitte gib eine gültige E‑Mail‑Adresse ein.'
    }

    setErrors(nextErrors)

    if (nextErrors.firstName) {
      firstNameRef.current?.focus()
      return false
    }

    if (nextErrors.email) {
      emailRef.current?.focus()
      return false
    }

    return true
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validate()) {
      setStatus('error')
      setStatusMessage('Bitte prüfe deine Eingaben.')
      return
    }

    setStatus('submitting')
    setStatusMessage('')

    const payload = {
      firstName: form.firstName.trim(),
      email: form.email.trim(),
      source: 'lead-magnet',
      utmSource: searchParams.get('utm_source'),
      utmMedium: searchParams.get('utm_medium'),
      utmCampaign: searchParams.get('utm_campaign'),
      utmContent: searchParams.get('utm_content'),
      utmTerm: searchParams.get('utm_term'),
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    }

    try {
      const response = await fetch('/api/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setStatus('error')
        setStatusMessage(
          data?.error || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
        )
        return
      }

      setStatus('success')
      setStatusMessage(
        'Geschafft! Bitte prüfe jetzt dein E‑Mail‑Postfach für Video 1.'
      )
      toast({
        variant: 'success',
        title: 'Quick‑Start gesichert',
        description: 'Video 1 ist unterwegs zu deinem Postfach.',
        duration: 6000,
      })
      setForm({ firstName: '', email: '' })
    } catch (error) {
      setStatus('error')
      setStatusMessage('Etwas ist schiefgelaufen. Bitte versuche es erneut.')
    }
  }

  return (
    <form className={cn('space-y-3', className)} onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label
          htmlFor={`${idPrefix}-firstName`}
          className="text-sm font-medium text-neutral-900"
        >
          Vorname
        </label>
        <Input
          ref={firstNameRef}
          id={`${idPrefix}-firstName`}
          name="firstName"
          type="text"
          autoComplete="given-name"
          placeholder="Dein Vorname…"
          value={form.firstName}
          onChange={handleChange('firstName')}
          aria-invalid={Boolean(errors.firstName)}
          aria-describedby={
            errors.firstName ? `${idPrefix}-firstName-error` : undefined
          }
        />
        {errors.firstName ? (
          <p
            id={`${idPrefix}-firstName-error`}
            className="text-pretty text-xs text-red-600"
          >
            {errors.firstName}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <label
          htmlFor={`${idPrefix}-email`}
          className="text-sm font-medium text-neutral-900"
        >
          E‑Mail
        </label>
        <Input
          ref={emailRef}
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          placeholder="name@beispiel.de…"
          value={form.email}
          onChange={handleChange('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined}
        />
        {errors.email ? (
          <p
            id={`${idPrefix}-email-error`}
            className="text-pretty text-xs text-red-600"
          >
            {errors.email}
          </p>
        ) : null}
      </div>
      <HeroPill
        href={WHOP_REVIEWS_URL}
        isExternal
        variant="amber"
        size="sm"
        announcement={
          <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className="h-3 w-3 fill-amber-500 text-amber-500"
                aria-hidden="true"
              />
            ))}
          </span>
        }
        label="5,0/5 • Whop‑Bewertungen"
      />
      <Button
        type="submit"
        size="lg"
        className={cn(
          'w-full touch-manipulation bg-blue-600 text-white hover:bg-blue-700',
          status === 'success' && 'opacity-80'
        )}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? 'Senden…' : buttonLabel}
      </Button>
      <div aria-live="polite" className="text-pretty text-sm text-neutral-700">
        {status === 'error' ? statusMessage : null}
        <span className="sr-only">
          {status === 'success' ? statusMessage : ''}
        </span>
      </div>
    </form>
  )
}
