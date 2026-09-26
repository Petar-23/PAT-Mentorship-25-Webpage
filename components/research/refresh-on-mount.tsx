'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Re-renders the server tree once after mount. Used by /welcome when the
 * checkout sync granted access during this request: the layout (sidebar) was
 * rendered with the membership state from before the sync, and App Router keeps
 * layouts across client navigations until a refresh.
 */
export function ResearchRefreshOnMount() {
  const router = useRouter()
  useEffect(() => { router.refresh() }, [router])
  return null
}
