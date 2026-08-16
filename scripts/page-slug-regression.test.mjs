import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('page title updates preserve the existing public slug', async () => {
  const route = await readFile('app/api/pages/[id]/route.ts', 'utf8')

  assert.match(route, /updateData\.title\s*=\s*title/)
  assert.doesNotMatch(route, /updateData\.slug\s*=/)
  assert.doesNotMatch(route, /Date\.now\(\)/)
})
