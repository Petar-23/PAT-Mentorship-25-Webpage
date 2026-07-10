-- Provider-independent Discord account binding. Existing Stripe metadata is
-- intentionally not backfilled here because migrations must not call Stripe;
-- OAuth/disconnect paths migrate legacy bindings on first use.
ALTER TABLE "RaidMapSubscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);

CREATE TABLE "UserDiscordAccount" (
    "userId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDiscordAccount_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "UserDiscordAccount_discordUserId_key" ON "UserDiscordAccount"("discordUserId");
CREATE INDEX "UserDiscordAccount_updatedAt_idx" ON "UserDiscordAccount"("updatedAt");

-- Durable desired-state queue. Repeated provider events upsert the same row;
-- failed external revocations stay retryable instead of being lost in logs.
CREATE TABLE "EntitlementRevocationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entitlement" TEXT NOT NULL,
    "desiredState" TEXT NOT NULL DEFAULT 'revoked',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastWorkerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementRevocationJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntitlementRevocationJob_userId_entitlement_key"
ON "EntitlementRevocationJob"("userId", "entitlement");
CREATE INDEX "EntitlementRevocationJob_status_nextRetryAt_idx"
ON "EntitlementRevocationJob"("status", "nextRetryAt");
CREATE INDEX "EntitlementRevocationJob_userId_status_idx"
ON "EntitlementRevocationJob"("userId", "status");

-- Shared serverless rate-limit state. Callers store only a one-way key hash,
-- never raw IP/email/user identifiers.
CREATE TABLE "RateLimitBucket" (
    "keyHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
