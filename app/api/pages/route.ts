// app/api/pages/route.ts
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

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = await getIsAdmin()

  const pages = await prisma.page.findMany({
    where: isAdmin ? undefined : { published: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      iconUrl: true,
      published: true,
      order: true,
    },
  })

  return NextResponse.json({ pages })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = await getIsAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { title?: string; description?: string; iconUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = (body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  let slug = generateSlug(title)

  // Ensure uniqueness
  const existing = await prisma.page.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now()}`
  }

  const page = await prisma.page.create({
    data: {
      title,
      slug,
      description: body.description?.trim() || null,
      iconUrl: body.iconUrl || null,
    },
  })

  return NextResponse.json(page, { status: 201 })
}
