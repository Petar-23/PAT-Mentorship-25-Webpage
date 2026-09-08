export const MAX_SHOW_NOTES_LENGTH = 30_000

export function normalizeShowNotes(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('Shownotes müssen Text sein.')
  if (value.length > MAX_SHOW_NOTES_LENGTH) {
    throw new Error('Shownotes dürfen höchstens 30.000 Zeichen enthalten.')
  }
  return value.replace(/\r\n?/g, '\n').trim() || null
}
