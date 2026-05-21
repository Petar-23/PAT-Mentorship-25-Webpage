import 'server-only'
import { unstable_cache } from 'next/cache'

type Props = {
  pageId: string
  title: string
  content: Record<string, unknown> | null
  updatedAt: Date | string
}

async function renderPageHtml(content: Record<string, unknown>) {
  try {
    const [
      { generateHTML },
      { default: StarterKit },
      { Image: ImageExtension },
      { Link },
      { Table, TableRow, TableCell, TableHeader },
      { TextAlign },
      { Highlight },
      { Color },
      { TextStyle },
      { Typography },
      { Underline },
    ] = await Promise.all([
      import('@tiptap/html'),
      import('@tiptap/starter-kit'),
      import('@tiptap/extension-image'),
      import('@tiptap/extension-link'),
      import('@tiptap/extension-table'),
      import('@tiptap/extension-text-align'),
      import('@tiptap/extension-highlight'),
      import('@tiptap/extension-color'),
      import('@tiptap/extension-text-style'),
      import('@tiptap/extension-typography'),
      import('@tiptap/extension-underline'),
    ])

    return generateHTML(content as Parameters<typeof generateHTML>[0], [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ImageExtension.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
      Link.configure({
        HTMLAttributes: {
          class: 'text-primary underline hover:text-primary/80',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
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
    ])
  } catch {
    return '<p class="text-muted-foreground italic">Inhalt konnte nicht geladen werden.</p>'
  }
}

async function renderCachedPageHtml(
  pageId: string,
  updatedAt: Date | string,
  content: Record<string, unknown>
) {
  const version = updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt

  return unstable_cache(
    async () => renderPageHtml(content),
    ['mentorship-page-html', pageId, version],
    { revalidate: 60 * 60 }
  )()
}

export async function PageViewer({ pageId, title, content, updatedAt }: Props) {
  const html = content ? await renderCachedPageHtml(pageId, updatedAt, content) : ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{title}</h1>
      {content ? (
        <div
          className="ProseMirror max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-muted-foreground italic">Diese Seite hat noch keinen Inhalt.</p>
      )}
    </div>
  )
}
