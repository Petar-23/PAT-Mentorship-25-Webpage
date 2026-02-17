'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface BlogEditorProps {
  slug?: string
  initialContent?: string
  initialSha?: string
  isNew?: boolean
}

interface Frontmatter {
  title: string
  description: string
  date: string
  author: string
  tags: string
  image: string
  keywords: string
  draft: boolean
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const defaults: Frontmatter = {
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    author: 'Petar',
    tags: '',
    image: '/images/pat-banner.jpeg',
    keywords: '',
    draft: false,
  }

  if (!match) return { frontmatter: defaults, body: content }

  const fm = { ...defaults }
  match[1].split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return
    const key = line.slice(0, colonIdx).trim()
    let val = line.slice(colonIdx + 1).trim()
    val = val.replace(/^"(.*)"$/, '$1')

    if (key === 'draft') {
      fm.draft = val === 'true'
    } else if (key === 'tags' || key === 'keywords') {
      // Parse YAML array: ["a", "b"] → "a, b"
      const arrMatch = val.match(/^\[(.*)\]$/)
      if (arrMatch) {
        fm[key] = arrMatch[1].replace(/"/g, '').split(',').map(s => s.trim()).join(', ')
      } else {
        fm[key] = val
      }
    } else if (key in fm) {
      (fm as unknown as Record<string, string>)[key] = val
    }
  })

  return { frontmatter: fm, body: match[2] }
}

function buildMdxContent(fm: Frontmatter, body: string): string {
  const tagsArr = fm.tags.split(',').map(t => t.trim()).filter(Boolean)
  const kwArr = fm.keywords.split(',').map(t => t.trim()).filter(Boolean)

  return `---
title: "${fm.title}"
description: "${fm.description}"
date: "${fm.date}"
author: "${fm.author}"
tags: [${tagsArr.map(t => `"${t}"`).join(', ')}]
image: "${fm.image}"
keywords: [${kwArr.map(k => `"${k}"`).join(', ')}]
draft: ${fm.draft}
---

${body}`
}

export default function BlogEditor({ slug, initialContent = '', initialSha, isNew = false }: BlogEditorProps) {
  const router = useRouter()
  const parsed = parseFrontmatter(initialContent)

  const [fm, setFm] = useState<Frontmatter>(parsed.frontmatter)
  const [body, setBody] = useState(parsed.body)
  const [newSlug, setNewSlug] = useState(slug || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateFm = useCallback((key: keyof Frontmatter, value: string | boolean) => {
    setFm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleImageUpload = async (file: File) => {
    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/owner/blog/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      updateFm('image', data.path)
      setMessage({ type: 'success', text: `Bild hochgeladen: ${data.fileName}` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Upload fehlgeschlagen' })
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    const content = buildMdxContent(fm, body)
    const targetSlug = isNew ? newSlug : slug

    if (!targetSlug) {
      setMessage({ type: 'error', text: 'Slug ist erforderlich' })
      setSaving(false)
      return
    }

    try {
      if (isNew) {
        const res = await fetch('/api/owner/blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: targetSlug, content }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMessage({ type: 'success', text: 'Artikel erstellt! Vercel deployt in ~1 Min.' })
        setTimeout(() => router.push('/owner/blog'), 2000)
      } else {
        const res = await fetch(`/api/owner/blog/${slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, sha: initialSha }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setMessage({ type: 'success', text: 'Gespeichert! Vercel deployt in ~1 Min.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Fehler beim Speichern' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Artikel wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return

    setDeleting(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/owner/blog/${slug}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: 'Artikel gelöscht.' })
      setTimeout(() => router.push('/owner/blog'), 1500)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Fehler beim Löschen' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Status Message */}
      {message && (
        <div className={`rounded-lg border p-4 text-sm ${
          message.type === 'success'
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Slug (only for new) */}
      {isNew && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Slug (URL-Pfad)</label>
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="mein-artikel-titel"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <p className="mt-1 text-xs text-gray-500">Wird zur URL: /blog/{newSlug || '...'}</p>
        </div>
      )}

      {/* Frontmatter Fields */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Titel</label>
          <input
            type="text"
            value={fm.title}
            onChange={(e) => updateFm('title', e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Beschreibung (SEO)</label>
          <textarea
            value={fm.description}
            onChange={(e) => updateFm('description', e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Datum</label>
          <input
            type="date"
            value={fm.date}
            onChange={(e) => updateFm('date', e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Autor</label>
          <input
            type="text"
            value={fm.author}
            onChange={(e) => updateFm('author', e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Tags (kommagetrennt)</label>
          <input
            type="text"
            value={fm.tags}
            onChange={(e) => updateFm('tags', e.target.value)}
            placeholder="ICT Trading, Smart Money, Anfänger"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Keywords (SEO, kommagetrennt)</label>
          <input
            type="text"
            value={fm.keywords}
            onChange={(e) => updateFm('keywords', e.target.value)}
            placeholder="ICT Trading, Smart Money Konzepte"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-400">Artikelbild</label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition ${
              dragOver
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file)
              }}
            />
            {fm.image && fm.image !== '/images/pat-banner.jpeg' ? (
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                  <Image src={fm.image} alt="Artikelbild" fill className="object-cover" sizes="112px" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="truncate text-sm text-white">{fm.image}</p>
                  <p className="text-xs text-gray-500">Klicken oder Bild hierher ziehen zum Ändern</p>
                </div>
              </div>
            ) : (
              <div className="py-4">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    <span className="text-sm text-gray-400">Wird hochgeladen...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">Bild hierher ziehen oder klicken</p>
                    <p className="mt-1 text-xs text-gray-500">JPEG, PNG, WebP, GIF — max. 5 MB</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end md:col-span-2">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={fm.draft}
              onChange={(e) => updateFm('draft', e.target.checked)}
              className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-400">Entwurf (nicht öffentlich)</span>
          </label>
        </div>
      </div>

      {/* MDX Content Editor */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-400">Inhalt (MDX / Markdown)</label>
          <span className="text-xs text-gray-500">
            Unterstützt: Markdown, {'<Callout>'}, {'<YouTubeEmbed>'}, {'<CTABanner />'}
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={24}
          spellCheck={false}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm leading-relaxed text-gray-200 placeholder-gray-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="## Dein Artikel beginnt hier...&#10;&#10;Schreibe in Markdown oder nutze MDX-Komponenten."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-6">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-orange-500 px-6 py-2.5 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Speichern...' : isNew ? 'Erstellen' : 'Speichern'}
          </button>
          <button
            onClick={() => router.push('/owner/blog')}
            className="rounded-lg border border-slate-700 px-6 py-2.5 text-gray-400 transition hover:border-slate-600 hover:text-white"
          >
            Abbrechen
          </button>
        </div>

        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {deleting ? 'Löschen...' : 'Artikel löschen'}
          </button>
        )}
      </div>
    </div>
  )
}
