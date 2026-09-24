import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Execute the real data loader with local Prisma doubles. Never connect to a provider.
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const learningExports = {}
runInNewContext(compile(await readFile(new URL('./mentorship-learning.ts', import.meta.url), 'utf8')), { exports: learningExports })
const dashboardSource = compile(await readFile(new URL('./mentorship-dashboard.ts', import.meta.url), 'utf8'))
const sidebar = [{ id: 'course', name: 'Kurs', modulesLength: 1 }]
const course = { id: 'course', name: 'Kurs', modules: [{ id: 'module', name: 'Modul', order: 0, chapters: [{ id: 'chapter', order: 0, videos: [
  { id: 'a', title: 'A', order: 0, bunnyGuid: 'guid', pdfUrl: null, duration: 60 },
  { id: 'b', title: 'B', order: 1, bunnyGuid: null, pdfUrl: '/b.pdf', duration: null },
] }] }] }

function loader({ watchedByUser = { 'member-one': ['a'] }, lastId = 'a', failCounts = false, chapterRows = [{ id: 'chapter', module: { playlistId: 'course' }, _count: { videos: 2 } }] } = {}) {
  const calls = []
  const query = (name, result) => async args => { calls.push({ name, args }); return result }
  const prisma = {
    chapter: { findMany: async args => {
      calls.push({ name: 'chapters', args })
      if (failCounts) throw new Error('DB unavailable')
      return chapterRows.filter(chapter => args.where.module.playlistId.in.includes(chapter.module.playlistId))
    } },
    video: {
      groupBy: query('totals', [{ chapterId: 'chapter', _count: { _all: 2 } }]),
      findMany: query('recent', [
        { id: 'b', title: 'B', bunnyGuid: null, pdfUrl: '/b.pdf', createdAt: new Date('2026-09-24'), chapter: { module: { id: 'module', name: 'Modul', playlist: { name: 'Kurs' } } } },
        { id: 'a', title: 'A', bunnyGuid: 'guid', pdfUrl: null, createdAt: new Date('2026-09-23'), chapter: { module: { id: 'module', name: 'Modul', playlist: { name: 'Kurs' } } } },
      ]),
    },
    videoProgress: { findMany: async args => {
      calls.push({ name: 'watched', args })
      return (watchedByUser[args.where.userId] ?? []).map(id => ({ videoId: id, video: { id, chapter: { module: { playlistId: 'course' } } } }))
    } },
    userPlaybackState: { findUnique: query('lastOpened', { lastVideo: lastId ? { id: lastId, chapter: { module: { playlistId: 'course' } } } : null }) },
    playlist: { findUnique: query('course', course) },
  }
  const exports = {}
  runInNewContext(dashboardSource, { exports, require: name => {
    if (name === 'server-only') return {}
    if (name === '@/lib/mentorship-learning') return learningExports
    if (name === '@/lib/prisma') return { prisma, withPrismaRetry: fn => fn(), isTransientDbConnectionError: () => false }
    throw new Error(`Unexpected dependency: ${name}`)
  } })
  return { load: exports.getMentorshipDashboardData, calls }
}

test('member overview preserves totals, PDF recommendation and recent-content exclusion with five reads', async () => {
  const { load, calls } = loader()
  const data = await load('member-one', sidebar, null)
  assert.equal(data.courses[0].totalLessons, 2)
  assert.equal(data.courses[0].completedLessons, 1)
  assert.equal(data.courses[0].percent, 50)
  assert.equal(data.continueLearning.videoId, 'b')
  assert.equal(data.continueLearning.isPdf, true)
  assert.equal(data.newContent.length, 1)
  assert.equal(data.newContent[0].videoId, 'a')
  assert.equal(calls.find(call => call.name === 'watched').args.where.userId, 'member-one')
  assert.equal(calls.find(call => call.name === 'chapters').args.select._count.select.videos, true)
  assert.equal(calls.length, 5, 'avoid the separate lesson-count query')
})

test('admin overview omits personal progress and only needs two reads', async () => {
  const { load, calls } = loader()
  const data = await load(null, sidebar, null)
  assert.equal(data.courses[0].totalLessons, 2)
  assert.equal(data.courses[0].completedLessons, null)
  assert.equal(data.courses[0].percent, null)
  assert.equal(data.continueLearning, null)
  assert.equal(calls.length, 2)
})

test('no courses returns an empty overview without database work', async () => {
  const { load, calls } = loader()
  const data = await load('member-one', [], null)
  assert.equal(JSON.stringify(data), JSON.stringify({ courses: [], continueLearning: null, newContent: [] }))
  assert.equal(calls.length, 0)
})

test('separate requests do not reuse another members progress', async () => {
  const { load } = loader({ lastId: null })
  const first = await load('member-one', sidebar, null)
  const second = await load('member-two', sidebar, null)
  assert.equal(first.courses[0].completedLessons, 1)
  assert.equal(second.courses[0].completedLessons, 0)
  assert.equal(second.continueLearning.videoId, 'a')
})

test('counts sum across chapters without mixing courses, changing order or losing empty courses', async () => {
  const courses = [...sidebar, { id: 'second', name: 'Zweiter Kurs', modulesLength: 1 }, { id: 'empty', name: 'Leer', modulesLength: 0 }]
  const { load } = loader({ chapterRows: [
    { module: { playlistId: 'course' }, _count: { videos: 2 } },
    { module: { playlistId: 'course' }, _count: { videos: 3 } },
    { module: { playlistId: 'course' }, _count: { videos: 0 } },
    { module: { playlistId: 'second' }, _count: { videos: 4 } },
    { module: { playlistId: 'not-visible' }, _count: { videos: 99 } },
  ] })
  const data = await load(null, courses, ['second', 'empty', 'course'])
  assert.equal(JSON.stringify(data.courses.map(course => [course.id, course.totalLessons])), JSON.stringify([['second', 4], ['empty', 0], ['course', 5]]))
  assert.equal(courses[0].id, 'course', 'input order stays unchanged')
})

test('database failures remain errors instead of false zero progress', async () => {
  await assert.rejects(loader({ failCounts: true }).load('member-one', sidebar, null), /DB unavailable/)
})
