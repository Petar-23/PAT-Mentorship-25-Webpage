// @ts-nocheck -- Node executes TypeScript tests directly and requires explicit .ts specifiers.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SIDEBAR_STATIC_IDS,
  buildCourseSidebarIdentity,
  buildPageSidebarIdentity,
  buildStaticSidebarIdentity,
  orderSidebarItems,
  parseSidebarKey,
  parseSidebarOrder,
  resolveActiveSidebarId,
} from './sidebar-model.ts'

const identities = [
  buildStaticSidebarIdentity(SIDEBAR_STATIC_IDS.discord),
  buildStaticSidebarIdentity(SIDEBAR_STATIC_IDS.indicators),
  buildCourseSidebarIdentity('course-1'),
  buildPageSidebarIdentity('page-1'),
]

test('identity builders preserve the persisted and drag-and-drop keys', () => {
  assert.deepEqual(buildStaticSidebarIdentity(SIDEBAR_STATIC_IDS.discord), {
    kind: 'static',
    id: 'discord',
  })
  assert.deepEqual(buildCourseSidebarIdentity('course-1'), {
    kind: 'course',
    id: 'course-1',
    resourceId: 'course-1',
  })
  assert.deepEqual(buildPageSidebarIdentity('page-1'), {
    kind: 'page',
    id: 'page:page-1',
    resourceId: 'page-1',
  })
})

test('saved order parsing rejects unknown, non-string, duplicate, and ambiguous keys', () => {
  assert.deepEqual(
    parseSidebarOrder(['page:page-1', 'unknown', 42, 'discord', 'discord'], identities),
    ['page:page-1', 'discord']
  )
  assert.equal(parseSidebarOrder({ order: ['discord'] }, identities), null)
  assert.equal(parseSidebarKey('unknown', identities), null)

  const ambiguous = [
    buildCourseSidebarIdentity('page:page-1'),
    buildPageSidebarIdentity('page-1'),
  ]
  assert.equal(parseSidebarKey('page:page-1', ambiguous), null)
})

test('ordering applies known saved keys and keeps unsaved items in source order', () => {
  const ordered = orderSidebarItems(identities, [
    'page:page-1',
    'deleted-item',
    'discord',
  ])

  assert.deepEqual(ordered.map((item) => item.id), [
    'page:page-1',
    'discord',
    'indicators',
    'course-1',
  ])
})

test('active resolution retains static, course, and page route keys', () => {
  const context = {
    courses: [{ id: 'course-1' }],
    pages: [{ id: 'page-1', slug: 'about' }],
  }

  assert.equal(
    resolveActiveSidebarId({ ...context, pathname: '/mentorship/discord/rules' }),
    'discord'
  )
  assert.equal(
    resolveActiveSidebarId({ ...context, pathname: '/mentorship/course-1' }),
    'course-1'
  )
  assert.equal(
    resolveActiveSidebarId({
      ...context,
      pathname: '/mentorship',
      activeCourseId: 'course-1',
    }),
    'course-1'
  )
  assert.equal(
    resolveActiveSidebarId({ ...context, pathname: '/mentorship/page/about' }),
    'page:page-1'
  )
  assert.equal(
    resolveActiveSidebarId({ ...context, pathname: '/mentorship/missing' }),
    null
  )
})
