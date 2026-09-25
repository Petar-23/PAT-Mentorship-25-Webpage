import { Fragment } from 'react'
import type { LegalBlock, LegalInline, LegalLink } from '@/lib/legal-texts'

// Darstellung der Rechtstexte aus lib/legal-texts.ts auf /AGB und /Widerruf (Markup wie bisher).

const LINK_CLASS = 'text-blue-600 underline hover:text-blue-700'

export function LegalAnchor({ link }: { link: LegalLink }) {
  if (link.newTab) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {link.text}
      </a>
    )
  }
  return (
    <a href={link.href} className={LINK_CLASS}>
      {link.text}
    </a>
  )
}

export function LegalInlineContent({ content }: { content: LegalInline[] }) {
  return (
    <>
      {content.map((part, index) =>
        typeof part === 'string' ? <Fragment key={index}>{part}</Fragment> : <LegalAnchor key={index} link={part} />
      )}
    </>
  )
}

export function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === 'paragraph') {
    return (
      <p className="text-gray-600 mb-4">
        <LegalInlineContent content={block.content} />
      </p>
    )
  }

  const items = block.items.map((item, index) => (
    <li key={index}>
      <LegalInlineContent content={item} />
    </li>
  ))

  return block.type === 'ordered' ? (
    <ol className="list-decimal pl-6 space-y-2 text-gray-600">{items}</ol>
  ) : (
    <ul className="list-disc pl-6 space-y-2 text-gray-600">{items}</ul>
  )
}
