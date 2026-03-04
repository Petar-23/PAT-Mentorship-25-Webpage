'use client'

import { useEffect, useRef, useCallback } from 'react'
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
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
  Minus,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react'
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
      className={cn(
        'p-1.5 rounded-md text-sm transition-colors',
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
  const isSavingRef = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const save = useCallback(
    async (content: Record<string, unknown>, title?: string) => {
      if (isSavingRef.current) return
      isSavingRef.current = true
      try {
        const body: Record<string, unknown> = { content }
        if (title !== undefined) body.title = title
        await fetch(`/api/pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {
        // silent auto-save failure
      } finally {
        isSavingRef.current = false
      }
    },
    [page.id]
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
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        void save(editor.getJSON() as Record<string, unknown>)
      }, 2000)
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[400px] prose prose-sm dark:prose-invert max-w-none focus:outline-none',
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
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    const title = titleRef.current?.value?.trim() ?? page.title
    await save(editor.getJSON() as Record<string, unknown>, title)
    toast({ title: 'Gespeichert ✓', description: 'Seite wurde gespeichert.' })
  }

  const handlePublishToggle = async () => {
    const newPublished = !page.published
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newPublished }),
      })
      if (!res.ok) throw new Error('Fehler')
      toast({
        title: newPublished ? 'Veröffentlicht ✓' : 'Entwurf',
        description: newPublished ? 'Seite ist jetzt öffentlich.' : 'Seite ist jetzt ein Entwurf.',
      })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Fehler beim Ändern des Status' })
    }
  }

  const handleTitleBlur = async () => {
    const title = titleRef.current?.value?.trim()
    if (title && title !== page.title && editor) {
      await save(editor.getJSON() as Record<string, unknown>, title)
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

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
        <input
          ref={titleRef}
          defaultValue={page.title}
          onBlur={handleTitleBlur}
          className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 py-2"
          placeholder="Titel..."
        />
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
