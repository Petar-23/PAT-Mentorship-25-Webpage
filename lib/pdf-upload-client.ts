import { put } from '@vercel/blob/client'

type UploadOptions = {
  videoId: string
  expectedPdfUrl: string | null
  signal?: AbortSignal
  onProgress?: (percentage: number) => void
  onStage?: (stage: 'uploading' | 'saving') => void
}

export async function uploadLessonPdf(
  file: File,
  options: UploadOptions,
  services = { request: fetch, put },
): Promise<string> {
  const { request, put: putBlob } = services
  if ((file.type && file.type !== 'application/pdf') || !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Bitte eine PDF-Datei auswählen.')
  }
  if (file.size === 0 || file.size > 25 * 1024 * 1024) {
    throw new Error('Die PDF muss zwischen 1 Byte und 25 MB groß sein.')
  }
  if ((await file.slice(0, 5).text()) !== '%PDF-') throw new Error('Die Datei ist keine gültige PDF.')
  options.signal?.throwIfAborted()

  async function metadata(body: Record<string, unknown>) {
    const response = await request('/api/upload/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Die PDF konnte nicht gespeichert werden. Bitte erneut versuchen.')
    }
    if (!data || typeof data !== 'object') throw new Error('Die Serverantwort ist unvollständig. Bitte erneut versuchen.')
    return data
  }

  const prepared = await metadata({
    action: 'prepare', videoId: options.videoId,
    filename: file.name, size: file.size, expectedPdfUrl: options.expectedPdfUrl,
  })
  if (typeof prepared.pathname !== 'string' || typeof prepared.token !== 'string' || typeof prepared.filename !== 'string') {
    throw new Error('Der Upload konnte nicht vorbereitet werden. Bitte erneut versuchen.')
  }
  options.signal?.throwIfAborted()
  options.onStage?.('uploading')
  await putBlob(prepared.pathname, file, {
    token: prepared.token,
    access: 'private',
    contentType: 'application/pdf',
    multipart: true,
    abortSignal: options.signal,
    onUploadProgress: ({ percentage }) => options.onProgress?.(Math.round(percentage)),
  })
  options.signal?.throwIfAborted()
  options.onStage?.('saving')
  const saved = await metadata({
    action: 'complete', videoId: options.videoId,
    pathname: prepared.pathname, filename: prepared.filename,
    expectedPdfUrl: options.expectedPdfUrl,
  })
  if (typeof saved.pdfUrl !== 'string' || !saved.pdfUrl) throw new Error('Die Zuordnung zur Lektion fehlt. Bitte erneut versuchen.')
  return saved.pdfUrl
}
