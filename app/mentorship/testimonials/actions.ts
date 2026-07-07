'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { getIsAdmin } from '@/lib/authz'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { RAIDMAP_CONFIG } from '@/lib/raidmap-config'

// Review-Actions für Raid-Map-Testimonials (nur Owner/Admin).
// Nach jeder Entscheidung werden die Landing-Pfade revalidiert, damit
// approved Stimmen sofort erscheinen bzw. zurückgezogene verschwinden.

async function requireAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return false
  return getIsAdmin(userId, sessionClaims)
}

function revalidateTestimonialPaths() {
  revalidatePath(RAIDMAP_CONFIG.salesPathEn)
  revalidatePath(RAIDMAP_CONFIG.salesPathDe)
  revalidatePath('/mentorship/testimonials')
}

async function setTestimonialStatus(id: string, status: 'approved' | 'rejected') {
  if (!(await requireAdmin())) {
    throw new Error('Not authorized.')
  }

  await withPrismaRetry(
    () =>
      prisma.raidMapTestimonial.update({
        where: { id },
        data: { status, reviewedAt: new Date() },
      }),
    { label: `Set raidmap testimonial ${status}` }
  )

  revalidateTestimonialPaths()
}

export async function approveRaidMapTestimonialAction(id: string) {
  await setTestimonialStatus(id, 'approved')
}

export async function rejectRaidMapTestimonialAction(id: string) {
  await setTestimonialStatus(id, 'rejected')
}
