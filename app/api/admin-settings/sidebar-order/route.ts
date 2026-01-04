// app/api/admin-settings/sidebar-order/route.ts

import { prisma } from '@/lib/prisma'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// GET: Hole die gespeicherte Reihenfolge
export async function GET() {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Hier prüfen wir, ob der User Admin ist (Clerk Org Role)
  // Du kannst das später noch genauer machen – vorerst nur userId prüfen
  // (nur du als Entwickler hast Zugriff)

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
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const client = await clerkClient()
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  })

  const isAdmin = memberships.data.some((m) => m.role === 'org:admin')

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { order } = await request.json()  // z. B. ["discord", "kurs-1", "kurs-2"]

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