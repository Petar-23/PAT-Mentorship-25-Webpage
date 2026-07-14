const PROTECTED_PDF_PREFIX = '/api/download/pdf/'
const PRIVATE_BLOB_QUERY_KEY = 'blob'

function safePdfFilename(value: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  })()
  const basename = decoded.split('/').pop()?.replace(/[\r\n"\\]/g, '').trim() || 'document.pdf'
  return basename.toLowerCase().endsWith('.pdf') ? basename : `${basename}.pdf`
}

export function buildProtectedPdfUrl(
  videoId: string,
  filename: string,
  privateBlobPathname?: string
) {
  const route = `${PROTECTED_PDF_PREFIX}${encodeURIComponent(videoId)}/${encodeURIComponent(
    safePdfFilename(filename)
  )}`
  if (!privateBlobPathname) return route

  const search = new URLSearchParams({ [PRIVATE_BLOB_QUERY_KEY]: privateBlobPathname })
  return `${route}?${search.toString()}`
}

export function toProtectedPdfUrl(videoId: string, pdfUrl: string | null) {
  if (!pdfUrl) return null
  if (pdfUrl.startsWith(PROTECTED_PDF_PREFIX)) return pdfUrl

  let filename = 'document.pdf'
  try {
    filename = safePdfFilename(new URL(pdfUrl).pathname)
  } catch {
    filename = safePdfFilename(pdfUrl)
  }

  return buildProtectedPdfUrl(videoId, filename)
}

export function getPrivatePdfBlobPathname(pdfUrl: string, videoId: string) {
  if (!pdfUrl.startsWith(PROTECTED_PDF_PREFIX)) return null

  const parsed = new URL(pdfUrl, 'https://local.invalid')
  const pathname = parsed.searchParams.get(PRIVATE_BLOB_QUERY_KEY)
  if (!pathname) return null
  if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('://')) return null
  if (!pathname.startsWith(`pdfs/${videoId}/`)) return null
  if (!pathname.toLowerCase().endsWith('.pdf')) return null
  return pathname
}

export function getLegacyPublicPdfUrl(pdfUrl: string, videoId: string) {
  if (pdfUrl.startsWith(PROTECTED_PDF_PREFIX)) return null

  try {
    const parsed = new URL(pdfUrl)
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password) return null
    if (!parsed.hostname.endsWith('.public.blob.vercel-storage.com')) return null
    if (!parsed.pathname.startsWith(`/pdfs/${videoId}/`)) return null
    if (!parsed.pathname.toLowerCase().endsWith('.pdf')) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function getStoredPdfFilename(pdfUrl: string) {
  try {
    const parsed = new URL(pdfUrl, 'https://local.invalid')
    return safePdfFilename(parsed.pathname)
  } catch {
    return 'document.pdf'
  }
}
