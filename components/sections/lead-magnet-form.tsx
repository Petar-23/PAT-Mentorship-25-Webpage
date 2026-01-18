'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

const isValidEmail = (value: string) => {
  const email = value.trim()
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function LeadMagnetForm() {
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
    <section
      id="lead-magnet-form"
      className="scroll-mt-24 bg-neutral-950 px-3 py-16 text-neutral-50 sm:px-6 sm:py-24"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-pretty text-sm font-medium text-neutral-300">
              Starte Heute Kostenlos
            </p>
            <h2 className="text-balance mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Hol Dir Video 1 Und Die Checkliste
            </h2>
            <p className="text-pretty mt-4 text-base text-neutral-200 sm:text-lg">
              Du bekommst Video 1 sofort per E‑Mail. Video 2 und 3 folgen an den
              nächsten Tagen. Alles ist bewusst kompakt, damit du die Grundlagen
              sauber aufbaust.
            </p>
            <ul className="mt-6 space-y-2 text-pretty text-sm text-neutral-200">
              <li>• 3 klare Videos statt 700+ Chaos</li>
              <li>• PDF‑Checkliste plus Trading‑Plan</li>
              <li>• Einfache Abmeldung mit einem Klick</li>
            </ul>
          </div>
          <Card className="border-emerald-200 p-6 sm:p-8">
            <h3 className="text-balance text-xl font-semibold text-neutral-950">
              Kostenlos Anmelden
            </h3>
            <p className="text-pretty mt-2 text-sm text-neutral-600">
              Trage dich ein und starte sofort.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-neutral-900">
                  Vorname
                </label>
                <Input
                  ref={firstNameRef}
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Dein Vorname…"
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                />
                {errors.firstName ? (
                  <p
                    id="firstName-error"
                    className="text-pretty text-xs text-red-600"
                  >
                    {errors.firstName}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-neutral-900">
                  E‑Mail
                </label>
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="name@beispiel.de…"
                  value={form.email}
                  onChange={handleChange('email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email ? (
                  <p id="email-error" className="text-pretty text-xs text-red-600">
                    {errors.email}
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                size="lg"
                className={cn(
                  'w-full touch-manipulation bg-emerald-600 text-white hover:bg-emerald-700',
                  status === 'success' && 'opacity-80'
                )}
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Senden…' : 'Kostenlosen Quick‑Start Sichern'}
              </Button>
              <p className="text-pretty text-xs text-neutral-500">
                Mit dem Eintrag stimmst du unserer{' '}
                <Link href="/datenschutz" className="underline underline-offset-4">
                  Datenschutzerklärung
                </Link>{' '}
                zu.
              </p>
              <div aria-live="polite" className="text-pretty text-sm text-neutral-700">
                {status === 'error' ? statusMessage : null}
                <span className="sr-only">
                  {status === 'success' ? statusMessage : ''}
                </span>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </section>
  )
}
