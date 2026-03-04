'use client'

import { useEffect, useRef } from 'react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { Image as ImageExtension } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { Underline } from '@tiptap/extension-underline'

type Props = {
  title: string
  content: Record<string, unknown> | null
}

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  ImageExtension.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
  Link.configure({ HTMLAttributes: { class: 'text-primary underline hover:text-primary/80' } }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight.configure({ multicolor: true }),
  Color,
  TextStyle,
  Typography,
  Underline,
]

export function PageViewer({ title, content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  let html = ''
  try {
    if (content) {
      html = generateHTML(content as Parameters<typeof generateHTML>[0], extensions)
    }
  } catch {
    html = '<p class="text-muted-foreground italic">Inhalt konnte nicht geladen werden.</p>'
  }

  useEffect(() => {
    if (!containerRef.current) return
    // Make links open in new tab
    const links = containerRef.current.querySelectorAll('a')
    links.forEach((link) => {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    })
  }, [html])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{title}</h1>
      {content ? (
        <div
          ref={containerRef}
          className="ProseMirror max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-muted-foreground italic">Diese Seite hat noch keinen Inhalt.</p>
      )}
    </div>
  )
}
