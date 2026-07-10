// app/api/pages/[id]/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getIsAdmin, requireAdminApiAccess } from '@/lib/authz'
import { revalidateSidebarData } from '@/lib/sidebar-data'

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
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [isAdmin, page] = await Promise.all([
    getIsAdmin(userId, sessionClaims),
    prisma.page.findUnique({ where: { id } }),
  ])

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
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
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

  const existing = await prisma.page.findUnique({
    where: { id },
    select: { id: true, slug: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updateData: Record<string, any> = {}

  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Ungültiger Seitentitel.' }, { status: 400 })
    }
    const title = body.title.trim()
    const newSlug = generateSlug(title)
    if (!title || !newSlug) {
      return NextResponse.json(
        { error: 'Der Seitentitel muss mindestens ein Zeichen oder eine Zahl enthalten.' },
        { status: 400 }
      )
    }
    updateData.title = title
    if (newSlug !== existing.slug) {
      const conflict = await prisma.page.findFirst({
        where: { slug: newSlug, NOT: { id } },
        select: { id: true },
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

  const page = await prisma.page.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      iconUrl: true,
      published: true,
    },
  })
  const sidebarVisibleChanged =
    body.title !== undefined ||
    body.description !== undefined ||
    'iconUrl' in body ||
    body.published !== undefined

  if (sidebarVisibleChanged) {
    revalidateSidebarData()
  }

  return NextResponse.json(page)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdminApiAccess()
  if (!admin.ok) {
    return admin.response
  }

  const existing = await prisma.page.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.page.delete({ where: { id }, select: { id: true } })
  revalidateSidebarData()
  return NextResponse.json({ success: true })
}
