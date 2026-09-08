import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiAccess } from '@/lib/authz'
import { requireAgentUploadAccess } from '@/lib/agent-upload-auth'
import { prisma } from '@/lib/prisma'
import { normalizeShowNotes } from '@/lib/video-show-notes'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const hasAgentCredentials = request.headers.has('authorization') || request.headers.has('x-agent-upload-token')
  const access = hasAgentCredentials ? requireAgentUploadAccess(request) : await requireAdminApiAccess()
  if (!access.ok) return access.response

  let showNotes: string | null
  let expectedShowNotes: string | null | undefined
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('showNotes' in body)) {
      throw new Error('Shownotes fehlen in der Anfrage.')
    }
    showNotes = normalizeShowNotes(body.showNotes)
    if ('expectedShowNotes' in body) expectedShowNotes = normalizeShowNotes(body.expectedShowNotes)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ungültige Anfrage.' }, { status: 400 })
  }

  const { id } = await params
  try {
    const video = await prisma.video.update({
      where: { id, ...(expectedShowNotes !== undefined ? { showNotes: expectedShowNotes } : {}) },
      data: { showNotes },
      select: { id: true, showNotes: true, updatedAt: true },
    })
    return NextResponse.json(video)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      try {
        const current = await prisma.video.findUnique({ where: { id }, select: { showNotes: true } })
        if (!current) return NextResponse.json({ error: 'Lektion nicht gefunden.' }, { status: 404 })
        return NextResponse.json({
          error: 'Die Shownotes wurden zwischenzeitlich geändert. Dein Entwurf bleibt erhalten.',
          showNotes: current.showNotes,
        }, { status: 409 })
      } catch (readError) {
        console.error('Shownotes conflict lookup failed:', readError)
      }
    }
    console.error('Shownotes update failed:', error)
    return NextResponse.json({ error: 'Shownotes konnten nicht gespeichert werden. Bitte erneut versuchen.' }, { status: 500 })
  }
}
