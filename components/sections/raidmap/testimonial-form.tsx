'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitRaidMapTestimonialAction } from '@/app/raid-map/account/actions'

// Muss zum Server-Limit in account/actions.ts passen (TESTIMONIAL_TEXT_MAX).
const TEXT_MAX = 600

export function TestimonialForm() {
  const [displayName, setDisplayName] = useState('')
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmit = displayName.trim().length > 0 && rating >= 1 && rating <= 5 && text.trim().length > 0

  const submit = () => {
    if (isPending || !canSubmit) return
    setMessage(null)
    startTransition(async () => {
      const result = await submitRaidMapTestimonialAction({
        displayName: displayName.trim(),
        rating,
        text: text.trim(),
      })
      setOk(result.ok)
      setMessage(result.message)
    })
  }

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="testimonial-name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <Input
            id="testimonial-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="The name shown next to your words"
            maxLength={80}
            className="mt-1 sm:max-w-xs"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-gray-700">Rating</span>
          <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label="Rating from 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                onClick={() => setRating(value)}
                className={`text-2xl leading-none transition-colors ${
                  value <= rating ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="testimonial-text" className="block text-sm font-medium text-gray-700">
            Your experience
          </label>
          <Textarea
            id="testimonial-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            placeholder="What does the map actually do for your trading?"
            maxLength={TEXT_MAX}
            rows={4}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-400 tabular-nums">
            {text.length}/{TEXT_MAX}
          </p>
        </div>

        <div>
          <Button onClick={submit} disabled={isPending || !canSubmit}>
            {isPending ? 'Sending…' : 'Submit feedback'}
          </Button>
        </div>
      </div>

      {message ? (
        <p role={ok ? 'status' : 'alert'} className={`mt-3 text-sm text-pretty ${ok ? 'text-gray-600' : 'text-red-600'}`}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
