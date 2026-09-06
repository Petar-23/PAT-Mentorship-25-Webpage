import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('./mentorship-learning.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } })
const { selectLearningTarget: select, learningPercent, formatLearningDuration, hasLearningMaterial } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const video = (id, order, more = {}) => ({ id, title: id, order, bunnyGuid: 'media', pdfUrl: null, duration: 61, ...more })
const makeModule = (id, order, videos) => ({ id, name: id, order, chapters: [{ id: `${id}-chapter`, order: 0, videos }] })
const course = modules => ({ id: 'core', name: 'Core Content', modules })
const base = () => course([makeModule('structure', 0, [video('a', 0), video('b', 2), video('c', 7)]), makeModule('liquidity', 1, [video('d', 0)])])

test('first visit starts directly at the first available lesson', () => {
  const target = select(base(), new Set())
  assert.equal(target.reason, 'start'); assert.equal(target.videoId, 'a'); assert.equal(target.position, 1)
})
test('reopens an incomplete last lesson without promising a playback offset', () => {
  const target = select(base(), new Set(['a']), 'b')
  assert.equal(target.reason, 'last-opened'); assert.equal(target.videoId, 'b')
  assert.equal(target.position, 2); assert.equal(target.completedLessons, 1); assert.equal(target.totalLessons, 3)
})
test('completed last lesson advances by sequence despite gaps in order numbers', () => {
  const target = select(base(), new Set(['a', 'b']), 'b')
  assert.equal(target.reason, 'next'); assert.equal(target.videoId, 'c')
})
test('earlier open lesson in the current module precedes the next module', () => {
  const target = select(base(), new Set(['b', 'c']), 'c')
  assert.equal(target.reason, 'gap'); assert.equal(target.videoId, 'a')
})
test('finished module advances within the current course', () => {
  const target = select(base(), new Set(['a', 'b', 'c']), 'c')
  assert.equal(target.reason, 'next-module'); assert.equal(target.videoId, 'd')
})
test('a gap in an earlier module remains reachable', () => {
  const target = select(base(), new Set(['b', 'c', 'd']), 'd')
  assert.equal(target.reason, 'gap'); assert.equal(target.videoId, 'a')
})
test('a deleted last lesson falls back to the first available open lesson', () => {
  const target = select(base(), new Set(['a']), 'deleted')
  assert.equal(target.reason, 'next'); assert.equal(target.videoId, 'b')
})
test('PDF-only lessons are valid recommendations and carry PDF metadata', () => {
  const target = select(course([makeModule('m', 0, [video('pdf', 0, { bunnyGuid: null, pdfUrl: '/lesson.pdf', duration: null })])]), new Set())
  assert.equal(target.kind, 'lesson'); assert.equal(target.videoId, 'pdf'); assert.equal(target.isPdf, true)
})
test('a last-opened placeholder is skipped while it remains in the denominator', () => {
  const target = select(course([makeModule('m', 0, [video('empty', 0, { bunnyGuid: ' ' }), video('real', 1)])]), new Set(), 'empty')
  assert.equal(target.reason, 'next'); assert.equal(target.videoId, 'real'); assert.equal(target.totalLessons, 2)
})
test('only placeholders remaining means waiting, never course completion', () => {
  const target = select(course([makeModule('m', 0, [video('done', 0), video('empty', 1, { bunnyGuid: null })])]), new Set(['done']), 'done')
  assert.equal(target.kind, 'waiting'); assert.equal(target.moduleId, 'm'); assert.equal(target.percent, 50); assert.equal(target.hasAvailableLessons, true)
})
test('all lesson rows completed ends at this course', () => {
  const target = select(base(), new Set(['a', 'b', 'c', 'd']), 'd')
  assert.equal(target.kind, 'completed'); assert.equal(target.courseId, 'core'); assert.equal(target.percent, 100)
  assert.equal(target.totalLessons, 4)
})
test('empty course and empty module have honest waiting targets', () => {
  assert.deepEqual(select(course([]), new Set()), { courseId: 'core', courseName: 'Core Content', completedLessons: 0, totalLessons: 0, percent: 0, kind: 'waiting', moduleId: null, moduleName: null, hasAvailableLessons: false })
  assert.equal(select(course([makeModule('empty', 0, [])]), new Set()).moduleId, 'empty')
})
test('duplicate orders break ties by createdAt then id, without mutating source arrays', () => {
  const data = course([makeModule('later', 5, [video('z', 0)]), { id:'first',name:'first',order:0,chapters:[{id:'c2',order:1,videos:[video('later-chapter',0)]},{id:'c1',order:0,videos:[video('c',0,{createdAt:'2026-08-02'}),video('b',0,{createdAt:'2026-08-01'}),video('a',0,{createdAt:'2026-08-01'})]}] }])
  const snapshot = JSON.stringify(data)
  assert.equal(select(data, new Set()).videoId, 'a'); assert.equal(JSON.stringify(data), snapshot)
})
test('unrelated watched IDs do not inflate module progress', () => {
  const target = select(base(), new Set(['other-course', 'a']), 'b')
  assert.equal(target.completedLessons, 1); assert.equal(target.percent, 33)
})
test('an incomplete course cannot round to 100 percent', () => {
  assert.equal(learningPercent(200, 201), 99); assert.equal(learningPercent(201, 201), 100)
  assert.equal(learningPercent(0, 0), 0); assert.equal(learningPercent(NaN, 10), 0); assert.equal(learningPercent(-1, 10), 0)
})
test('durations use consistent German units and omit unknown values', () => {
  assert.equal(formatLearningDuration(61), '2 Min.'); assert.equal(formatLearningDuration(3600), '1 Std.')
  assert.equal(formatLearningDuration(7140), '1 Std. 59 Min.')
  for (const value of [null, undefined, 0, -1, NaN]) assert.equal(formatLearningDuration(value), null)
})
test('whitespace-only media fields do not count as material', () => {
  assert.equal(hasLearningMaterial({ bunnyGuid: ' ', pdfUrl: null }), false)
  assert.equal(hasLearningMaterial({ bunnyGuid: null, pdfUrl: '/lesson.pdf' }), true)
})
