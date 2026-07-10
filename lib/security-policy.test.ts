// @ts-nocheck -- Node 25 executes TypeScript tests directly and requires explicit .ts specifiers.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getConfiguredAdminOrganizationId,
  hasPlatformAdminSessionClaim,
  isPlatformAdminContext,
} from './authz-policy.ts'
import { getVerifiedPrimaryEmail, parseNormalizedEmailCsv } from './clerk-email.ts'
import { selectUniqueEmailFallbackCustomer } from './stripe-customer-policy.ts'

test('platform admin policy fails closed without the configured organization', () => {
  assert.equal(getConfiguredAdminOrganizationId(undefined), null)
  assert.equal(
    isPlatformAdminContext({ orgId: 'org_admin', orgRole: 'org:admin' }, null),
    false
  )
})

test('platform admin policy requires both the exact role and organization', () => {
  assert.equal(
    isPlatformAdminContext(
      { orgId: 'org_admin', orgRole: 'org:admin' },
      'org_admin'
    ),
    true
  )
  assert.equal(
    isPlatformAdminContext(
      { orgId: 'org_other', orgRole: 'org:admin' },
      'org_admin'
    ),
    false
  )
  assert.equal(
    hasPlatformAdminSessionClaim(
      { org_id: 'org_admin', org_role: 'org:member' },
      'org_admin'
    ),
    false
  )
})

test('verified primary email must be the Clerk primary address and verified', () => {
  const verified = getVerifiedPrimaryEmail({
    primaryEmailAddressId: 'email_primary',
    emailAddresses: [
      {
        id: 'email_primary',
        emailAddress: 'owner@example.com',
        verification: { status: 'verified' },
      },
    ],
  })
  assert.equal(verified, 'owner@example.com')

  assert.equal(
    getVerifiedPrimaryEmail({
      primaryEmailAddressId: 'email_primary',
      emailAddresses: [
        {
          id: 'email_primary',
          emailAddress: 'owner@example.com',
          verification: { status: 'unverified' },
        },
      ],
    }),
    null
  )
})

test('mentorship override CSV is empty when missing and normalizes configured emails', () => {
  assert.deepEqual([...parseNormalizedEmailCsv(undefined)], [])
  assert.deepEqual(
    [...parseNormalizedEmailCsv(' Owner@Example.com, second@example.com, ')],
    ['owner@example.com', 'second@example.com']
  )
})

test('email fallback must be unique and never owned by another user', () => {
  assert.equal(
    selectUniqueEmailFallbackCustomer(
      [{ id: 'cus_1', metadata: { userId: 'user_other' } }],
      'user_current'
    ),
    null
  )
  assert.equal(
    selectUniqueEmailFallbackCustomer(
      [{ id: 'cus_1', metadata: {} }, { id: 'cus_2', metadata: {} }],
      'user_current'
    ),
    null
  )
  assert.deepEqual(
    selectUniqueEmailFallbackCustomer([{ id: 'cus_1', metadata: {} }], 'user_current'),
    {
      customer: { id: 'cus_1', metadata: {} },
      shouldLinkUserId: true,
    }
  )
})
