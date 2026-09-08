'use client'

import { useEffect, useId, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { MAX_SHOW_NOTES_LENGTH, normalizeShowNotes } from '@/lib/video-show-notes'

type Props = {
  videoId: string
  showNotes: string | null
  isAdmin: boolean
  onSaved: (videoId: string, showNotes: string | null) => void
}

type Draft = { text: string; base: string | null }

function readDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (value && typeof value.text === 'string' && value.text.length <= MAX_SHOW_NOTES_LENGTH &&
      (value.base === null || typeof value.base === 'string')) return value
  } catch { /* Storage may be unavailable. Editing still works. */ }
  return null
}

function storeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(key, JSON.stringify(draft))
    else sessionStorage.removeItem(key)
  } catch { /* Keep the draft in component state if storage is unavailable. */ }
}

function NotesBody({ text }: { text: string }) {
  return (
    <div className="m-show-notes-body">
      <ReactMarkdown
        skipHtml
        allowedElements={['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'pre', 'code']}
        components={{
          h1: ({ children }) => <h3>{children}</h3>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h3>{children}</h3>,
          h4: ({ children }) => <h4>{children}</h4>,
          h5: ({ children }) => <h4>{children}</h4>,
          h6: ({ children }) => <h4>{children}</h4>,
        }}
      >{text}</ReactMarkdown>
    </div>
  )
}

export function LessonShowNotes({ videoId, showNotes, isAdmin, onSaved }: Props) {
  const id = useId()
  const draftKey = `pat-show-notes-v1:${videoId}`
  const [draft, setDraft] = useState<Draft>({ text: showNotes ?? '', base: showNotes })
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [conflict, setConflict] = useState<{ showNotes: string | null } | null>(null)
  const editButton = useRef<HTMLButtonElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isAdmin) return
    const stored = readDraft(draftKey)
    if (stored) {
      setDraft(stored)
      setEditing(true)
      setStatus('Dein nicht gespeicherter Entwurf wurde wiederhergestellt.')
    }
  }, [draftKey, isAdmin])

  useEffect(() => {
    if (editing && !preview) textarea.current?.focus()
  }, [editing, preview])

  const beginEdit = () => {
    setDraft({ text: showNotes ?? '', base: showNotes })
    setEditing(true)
    setPreview(false)
    setError('')
    setStatus('')
    setConflict(null)
  }

  const closeEditor = () => {
    storeDraft(draftKey, null)
    setEditing(false)
    setConflict(null)
    setError('')
    setPreview(false)
    requestAnimationFrame(() => editButton.current?.focus())
  }

  const save = async (expectedShowNotes = draft.base) => {
    if (saving) return
    setSaving(true)
    setError('')
    const nextDraft = { ...draft, base: expectedShowNotes }
    setDraft(nextDraft)
    storeDraft(draftKey, nextDraft)
    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/show-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showNotes: normalizeShowNotes(draft.text), expectedShowNotes }),
      })
      const payload = await response.json().catch(() => null)
      if (response.status === 409 && payload && (payload.showNotes === null || typeof payload.showNotes === 'string')) {
        setConflict({ showNotes: payload.showNotes })
      }
      if (!response.ok) throw new Error(payload?.error || 'Shownotes konnten nicht gespeichert werden. Bitte erneut versuchen.')
      if (payload?.id !== videoId || !(payload.showNotes === null || typeof payload.showNotes === 'string')) {
        throw new Error('Das Speichern konnte nicht bestätigt werden. Dein Entwurf bleibt erhalten.')
      }
      onSaved(videoId, payload.showNotes)
      closeEditor()
      setStatus('Shownotes gespeichert.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Netzwerkfehler. Dein Entwurf bleibt erhalten.')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin && !showNotes?.trim()) return null

  return (
    <section className="m-show-notes" aria-labelledby={`${id}-heading`}>
      <div className="m-show-notes-heading">
        <h2 id={`${id}-heading`}>Shownotes</h2>
        {isAdmin && !editing ? (
          <Button ref={editButton} type="button" variant="ghost" onClick={beginEdit}>
            {showNotes ? 'Bearbeiten' : 'Shownotes hinzufügen'}
          </Button>
        ) : null}
      </div>
      {isAdmin && editing ? (
        <div className="m-show-notes-editor" aria-busy={saving}>
          <p id={`${id}-hint`} className="m-show-notes-hint">Füge deine Zusammenfassung ein. Überschriften mit ##, Listen mit - und **fette Stellen** werden formatiert. Nach dem Speichern sind die Shownotes für Mitglieder sichtbar.</p>
          <div className="m-show-notes-toolbar" role="group" aria-label="Ansicht der Shownotes">
            <Button type="button" variant={preview ? 'ghost' : 'secondary'} aria-pressed={!preview} onClick={() => setPreview(false)}>Text bearbeiten</Button>
            <Button type="button" variant={preview ? 'secondary' : 'ghost'} aria-pressed={preview} onClick={() => setPreview(true)}>Vorschau</Button>
          </div>
          {preview ? (
            <div className="m-show-notes-preview" aria-label="Vorschau der Shownotes">
              {draft.text.trim() ? <NotesBody text={draft.text} /> : <p className="m-show-notes-hint">Noch kein Text. Leere Shownotes werden für Mitglieder ausgeblendet.</p>}
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor={`${id}-text`}>Shownotes bearbeiten</label>
              <textarea
                ref={textarea}
                id={`${id}-text`}
                value={draft.text}
                maxLength={MAX_SHOW_NOTES_LENGTH}
                disabled={saving}
                aria-describedby={`${id}-hint ${id}-count`}
                onChange={(event) => {
                  const next = { ...draft, text: event.target.value }
                  setDraft(next)
                  storeDraft(draftKey, next)
                  setStatus('Nicht gespeichert.')
                }}
                rows={16}
              />
            </>
          )}
          <p id={`${id}-count`} className="m-show-notes-hint m-show-notes-count">{draft.text.length.toLocaleString('de-DE')} / 30.000 Zeichen</p>
          {error ? <p className="m-show-notes-error" role="alert">{error}</p> : null}
          {conflict ? (
            <div className="m-show-notes-conflict">
              <details><summary>Aktuell gespeicherte Fassung ansehen</summary>
                {conflict.showNotes ? <NotesBody text={conflict.showNotes} /> : <p>Aktuell sind keine Shownotes gespeichert.</p>}
              </details>
              <div className="m-show-notes-toolbar">
                <Button type="button" disabled={saving} onClick={() => void save(conflict.showNotes)}>Meinen Entwurf speichern</Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => {
                  onSaved(videoId, conflict.showNotes)
                  closeEditor()
                  setStatus('Aktuell gespeicherte Fassung übernommen.')
                }}>Gespeicherte Fassung übernehmen</Button>
              </div>
            </div>
          ) : null}
          <div className="m-show-notes-toolbar">
            {!conflict ? <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Wird gespeichert…' : 'Shownotes speichern'}</Button> : null}
            <Button type="button" variant="outline" disabled={saving} onClick={() => { closeEditor(); setStatus('Bearbeitung verworfen.') }}>Abbrechen</Button>
          </div>
        </div>
      ) : showNotes ? <NotesBody text={showNotes} /> : null}
      <p className="m-show-notes-hint" role="status">{status}</p>
    </section>
  )
}
