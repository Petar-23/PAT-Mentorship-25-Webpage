'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type Props = {
  content: string
  className?: string
}

const markdownComponents: Components = {
  h1: ({ children }) => <h3 className="text-base font-semibold text-foreground">{children}</h3>,
  h2: ({ children }) => <h4 className="text-sm font-semibold text-foreground">{children}</h4>,
  h3: ({ children }) => <h5 className="text-sm font-semibold text-foreground">{children}</h5>,
  p: ({ children }) => <p className="leading-relaxed text-muted-foreground">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="rounded-r-md border-l-2 border-border bg-background/70 py-2 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => (
    <code className={cn('rounded bg-background px-1.5 py-0.5 font-mono text-[0.85em] text-foreground', className)}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md border bg-background p-3 text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-4"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-md border bg-background">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b bg-muted/70 px-3 py-2 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="border-t px-3 py-2 text-muted-foreground">{children}</td>,
  hr: () => <hr className="border-border" />,
}

export function IndicatorUsageGuide({ content, className }: Props) {
  return (
    <div className={cn('space-y-3 text-sm', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
