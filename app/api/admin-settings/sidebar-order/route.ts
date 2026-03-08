// app/api/admin-settings/sidebar-order/route.ts

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'

// GET: Hole die gespeicherte Reihenfolge
export async function GET() {
  const guard = await requireAdminApiAccess()
  if (!guard.ok) return guard.response

  const setting = await prisma.adminSetting.findUnique({
    where: { key: 'sidebarOrder' },
  })

  if (!setting) {
    return NextResponse.json({ order: null })
  }

  return NextResponse.json({ order: setting.value })
}

// POST: Speichere neue Reihenfolge
export async function POST(request: Request) {
  const guard = await requireAdminApiAccess()
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => null)) as { order?: unknown } | null
  const order = body?.order // z. B. ["discord", "kurs-1", "kurs-2"]

  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  }

  await prisma.adminSetting.upsert({
    where: { key: 'sidebarOrder' },
    update: { value: order },
    create: { key: 'sidebarOrder', value: order },
  })

  return NextResponse.json({ success: true })
}