// app/api/pages/[id]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getIsAdmin } from '@/lib/authz'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[äöüÄÖÜ]/g, (c) =>
      ({ ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'ae', Ö: 'oe', Ü: 'ue' })[c] ?? c
    )
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = await getIsAdmin()

  const page = await prisma.page.findUnique({ where: { id } })

  if (!page || (!isAdmin && !page.published)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(page)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    title?: string
    description?: string
    iconUrl?: string | null
    content?: unknown
    published?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const existing = await prisma.page.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (body.title !== undefined) {
    const title = body.title.trim()
    updateData.title = title
    const newSlug = generateSlug(title)
    if (newSlug !== existing.slug) {
      const conflict = await prisma.page.findFirst({
        where: { slug: newSlug, NOT: { id } },
      })
      updateData.slug = conflict ? `${newSlug}-${Date.now()}` : newSlug
    }
  }

  if (body.description !== undefined) {
    updateData.description = body.description?.trim() || null
  }
  if ('iconUrl' in body) {
    updateData.iconUrl = body.iconUrl || null
  }
  if (body.content !== undefined) {
    updateData.content = body.content
  }
  if (body.published !== undefined) {
    updateData.published = body.published
  }

  const page = await prisma.page.update({ where: { id }, data: updateData })
  return NextResponse.json(page)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await prisma.page.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.page.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
