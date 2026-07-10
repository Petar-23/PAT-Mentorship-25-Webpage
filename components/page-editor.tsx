'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Image as ImageExtension } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { Underline } from '@tiptap/extension-underline'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { upload } from '@vercel/blob/client'
import { AlignLeft } from '@phosphor-icons/react/AlignLeft'
import { AlignRight } from '@phosphor-icons/react/AlignRight'
import { ArrowClockwise as Redo } from '@phosphor-icons/react/ArrowClockwise'
import { ArrowCounterClockwise as Undo } from '@phosphor-icons/react/ArrowCounterClockwise'
import { Eye } from '@phosphor-icons/react/Eye'
import { EyeSlash as EyeOff } from '@phosphor-icons/react/EyeSlash'
import { FloppyDisk as Save } from '@phosphor-icons/react/FloppyDisk'
import { Highlighter } from '@phosphor-icons/react/Highlighter'
import { Image as ImageIcon } from '@phosphor-icons/react/Image'
import { Link as LinkIcon } from '@phosphor-icons/react/Link'
import { List } from '@phosphor-icons/react/List'
import { ListNumbers as ListOrdered } from '@phosphor-icons/react/ListNumbers'
import { Minus } from '@phosphor-icons/react/Minus'
import { Quotes as Quote } from '@phosphor-icons/react/Quotes'
import { Table as TableIcon } from '@phosphor-icons/react/Table'
import { TextAlignCenter as AlignCenter } from '@phosphor-icons/react/TextAlignCenter'
import { TextB as Bold } from '@phosphor-icons/react/TextB'
import { TextHOne as Heading1 } from '@phosphor-icons/react/TextHOne'
import { TextHThree as Heading3 } from '@phosphor-icons/react/TextHThree'
import { TextHTwo as Heading2 } from '@phosphor-icons/react/TextHTwo'
import { TextItalic as Italic } from '@phosphor-icons/react/TextItalic'
import { TextStrikethrough as Strikethrough } from '@phosphor-icons/react/TextStrikethrough'
import { TextUnderline as UnderlineIcon } from '@phosphor-icons/react/TextUnderline'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

type PageData = {
  id: string
  title: string
  slug: string
  content: Record<string, unknown> | null
  published: boolean
}

type Props = {
  page: PageData
}

type SaveRequest = {
  content: Record<string, unknown>
  title?: string
  revision: number
  keepalive?: boolean
}

type SaveResult =
  | { ok: true }
  | { ok: false; error: string }

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'p-1.5 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" />
}

export function PageEditor({ page }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const pendingSaveCountRef = useRef(0)
  const latestRevisionRef = useRef(0)
  const savedRevisionRef = useRef(0)
  const latestContentRef = useRef<Record<string, unknown>>(
    page.content ?? { type: 'doc', content: [] }
  )
  const latestTitleRef = useRef(page.title)
  const titleDirtyRef = useRef(false)
  const isMountedRef = useRef(true)
  const titleRef = useRef<HTMLInputElement>(null)
  const publishAbortRef = useRef<AbortController | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const enqueueSave = useCallback(
    (request: SaveRequest): Promise<SaveResult> => {
      pendingSaveCountRef.current += 1

      if (isMountedRef.current) {
        setSaveStatus('saving')
        setSaveError(null)
      }

      const run = async (): Promise<SaveResult> => {
        try {
          const body: Record<string, unknown> = { content: request.content }
          if (request.title !== undefined) body.title = request.title

          const response = await fetch(`/api/pages/${page.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: request.keepalive,
          })

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as
              | { error?: string; message?: string }
              | null
            throw new Error(
              data?.error || data?.message || `Speichern fehlgeschlagen (${response.status})`
            )
          }

          savedRevisionRef.current = Math.max(savedRevisionRef.current, request.revision)
          if (
            request.title !== undefined &&
            request.title === latestTitleRef.current.trim()
          ) {
            titleDirtyRef.current = false
          }
          return { ok: true }
        } catch (error) {
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Speichern',
          }
        }
      }

      const task = saveQueueRef.current.then(run)
      saveQueueRef.current = task.then(() => undefined)

      void task.then((result) => {
        pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1)
        if (!isMountedRef.current) return

        if (pendingSaveCountRef.current > 0) {
          setSaveStatus('saving')
          return
        }

        if (!result.ok && request.revision >= latestRevisionRef.current) {
          setSaveStatus('error')
          setSaveError(result.error)
          return
        }

        if (
          savedRevisionRef.current >= latestRevisionRef.current &&
          !titleDirtyRef.current
        ) {
          setSaveStatus('saved')
          setSaveError(null)
          return
        }

        if (titleDirtyRef.current && !latestTitleRef.current.trim()) {
          setSaveStatus('error')
          setSaveError('Der Seitentitel darf nicht leer sein.')
          return
        }

        setSaveStatus('saving')
      })

      return task
    },
    [page.id]
  )

  const scheduleAutosave = useCallback(
    (content: Record<string, unknown>, title: string, titleChanged = false) => {
      latestContentRef.current = content
      latestTitleRef.current = title
      if (titleChanged) titleDirtyRef.current = true
      latestRevisionRef.current += 1

      if (isMountedRef.current) {
        setSaveStatus('saving')
        setSaveError(null)
      }

      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null
        const normalizedTitle = latestTitleRef.current.trim()
        const pendingTitle = titleDirtyRef.current && normalizedTitle
          ? normalizedTitle
          : undefined
        void enqueueSave({
          content: latestContentRef.current,
          title: pendingTitle,
          revision: latestRevisionRef.current,
        })
      }, 2000)
    },
    [enqueueSave]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ImageExtension.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline hover:text-primary/80' } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: 'Beginne zu schreiben...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      Typography,
      Underline,
    ],
    content: page.content ?? undefined,
    onUpdate: ({ editor }) => {
      scheduleAutosave(
        editor.getJSON() as Record<string, unknown>,
        titleRef.current?.value ?? latestTitleRef.current
      )
    },
    editorProps: {
      attributes: {
        'aria-label': 'Seiteninhalt',
        class: 'min-h-[400px] max-w-none rounded-md outline-none prose prose-sm dark:prose-invert focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
        if (!imageFile) return false
        event.preventDefault()
        void handleImageUpload(imageFile, view.state.selection.from)
        return true
      },
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files
        if (!files || files.length === 0) return false
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
        if (!imageFile) return false
        event.preventDefault()
        void handleImageUpload(imageFile)
        return true
      },
    },
  })

  async function handleImageUpload(file: File, pos?: number) {
    try {
      const blob = await upload(`page-images/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/page-image-upload',
      })
      if (editor) {
        const chain = editor.chain().focus()
        if (pos !== undefined) {
          chain.insertContentAt(pos, { type: 'image', attrs: { src: blob.url } }).run()
        } else {
          chain.setImage({ src: blob.url }).run()
        }
      }
    } catch {
      toast({ variant: 'destructive', title: 'Bild-Upload fehlgeschlagen' })
    }
  }

  const handleManualSave = async () => {
    if (!editor) return
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current)
      saveTimeout.current = null
    }
    latestContentRef.current = editor.getJSON() as Record<string, unknown>
    const title = titleRef.current?.value?.trim() ?? page.title
    if (!title) {
      setSaveStatus('error')
      setSaveError('Der Seitentitel darf nicht leer sein.')
      titleRef.current?.focus()
      toast({
        variant: 'destructive',
        title: 'Titel fehlt',
        description: 'Gib der Seite vor dem Speichern einen Titel.',
      })
      return
    }
    latestTitleRef.current = title
    const result = await enqueueSave({
      content: latestContentRef.current,
      title,
      revision: latestRevisionRef.current,
    })

    if (result.ok) {
      const hasNewerChanges =
        savedRevisionRef.current < latestRevisionRef.current || titleDirtyRef.current
      toast({
        title: hasNewerChanges ? 'Zwischenstand gespeichert' : 'Gespeichert ✓',
        description: hasNewerChanges
          ? 'Neuere Änderungen werden noch gespeichert.'
          : 'Seite wurde gespeichert.',
      })
      return
    }

    toast({
      variant: 'destructive',
      title: 'Speichern fehlgeschlagen',
      description: result.error,
    })
  }

  const handlePublishToggle = async () => {
    const newPublished = !page.published
    publishAbortRef.current?.abort()
    const controller = new AbortController()
    publishAbortRef.current = controller

    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newPublished }),
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (!res.ok) throw new Error('Fehler')
      toast({
        title: newPublished ? 'Veröffentlicht ✓' : 'Entwurf',
        description: newPublished ? 'Seite ist jetzt öffentlich.' : 'Seite ist jetzt ein Entwurf.',
      })
      router.refresh()
    } catch {
      if (controller.signal.aborted) return
      toast({ variant: 'destructive', title: 'Fehler beim Ändern des Status' })
    } finally {
      if (publishAbortRef.current === controller) {
        publishAbortRef.current = null
      }
    }
  }

  const handleTitleBlur = async () => {
    const title = titleRef.current?.value?.trim()
    if (!title && titleDirtyRef.current) {
      setSaveStatus('error')
      setSaveError('Der Seitentitel darf nicht leer sein.')
      return
    }
    if (title && titleDirtyRef.current && editor) {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current)
        saveTimeout.current = null
      }
      latestContentRef.current = editor.getJSON() as Record<string, unknown>
      latestTitleRef.current = title
      titleDirtyRef.current = true
      await enqueueSave({
        content: latestContentRef.current,
        title,
        revision: latestRevisionRef.current,
      })
    }
  }

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false

      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current)
        saveTimeout.current = null
      }

      if (savedRevisionRef.current < latestRevisionRef.current) {
        const normalizedTitle = latestTitleRef.current.trim()
        const pendingTitle = titleDirtyRef.current && normalizedTitle
          ? normalizedTitle
          : undefined
        void enqueueSave({
          content: latestContentRef.current,
          title: pendingTitle,
          revision: latestRevisionRef.current,
          keepalive: true,
        })
      }

      publishAbortRef.current?.abort()
    }
  }, [enqueueSave])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* Title area */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-8 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            page.published
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          )}>
            {page.published ? 'Veröffentlicht' : 'Entwurf'}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePublishToggle}>
              {page.published ? (
                <><EyeOff className="h-4 w-4 mr-1.5" /> Entwurf</>
              ) : (
                <><Eye className="h-4 w-4 mr-1.5" /> Veröffentlichen</>
              )}
            </Button>
            <Button size="sm" onClick={handleManualSave}>
              <Save className="h-4 w-4 mr-1.5" /> Speichern
            </Button>
          </div>
        </div>
        <label htmlFor="page-editor-title" className="sr-only">
          Seitentitel
        </label>
        <input
          id="page-editor-title"
          ref={titleRef}
          defaultValue={page.title}
          onChange={(event) => {
            scheduleAutosave(latestContentRef.current, event.currentTarget.value, true)
          }}
          onBlur={handleTitleBlur}
          className="w-full rounded-md bg-transparent py-2 text-3xl font-bold outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Titel..."
        />
        <div aria-live="polite" aria-atomic="true" className="min-h-5">
          {saveStatus === 'saving' ? (
            <p className="text-xs text-muted-foreground">Speichert…</p>
          ) : saveStatus === 'saved' ? (
            <p className="text-xs text-emerald-700">Alle Änderungen gespeichert.</p>
          ) : saveStatus === 'error' ? (
            <p className="text-xs text-red-700" role="alert">
              Speichern fehlgeschlagen: {saveError}
            </p>
          ) : null}
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-1.5">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-0.5">
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Überschrift 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Überschrift 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Überschrift 3">
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Fett">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Kursiv">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Unterstreichen">
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Durchgestrichen">
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Markieren">
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Links">
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Zentriert">
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rechts">
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Aufzählung">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Nummerierte Liste">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Zitat">
            <Quote className="h-4 w-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) void handleImageUpload(file)
              }
              input.click()
            }}
            title="Bild einfügen"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => {
              const url = window.prompt('URL eingeben:')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            active={editor.isActive('link')}
            title="Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title="Tabelle"
          >
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Trennlinie">
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Rückgängig">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Wiederholen">
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
