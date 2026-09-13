import { Check } from '@phosphor-icons/react/Check'

export function ActionFeedbackIcon({ state }: { state: 'pending' | 'success' }) {
  return <span className="m-action-feedback-icon" data-state={state} aria-hidden="true">
    {state === 'pending' ? <span className="m-action-spinner" /> : <Check />}
  </span>
}
