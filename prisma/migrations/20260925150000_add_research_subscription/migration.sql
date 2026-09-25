-- CreateTable
CREATE TABLE "ResearchSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tier" TEXT,
    "billingInterval" TEXT,
    "priceId" TEXT,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "pastDueSince" TIMESTAMP(3),
    "stripeCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchRateLimit" (
    "keyHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchRateLimit_pkey" PRIMARY KEY ("keyHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSubscription_userId_key" ON "ResearchSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSubscription_stripeSubscriptionId_key" ON "ResearchSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "ResearchSubscription_status_idx" ON "ResearchSubscription"("status");

-- CreateIndex
CREATE INDEX "ResearchSubscription_stripeCustomerId_idx" ON "ResearchSubscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "ResearchConsentEvent_userId_kind_createdAt_idx" ON "ResearchConsentEvent"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchConsentEvent_reference_idx" ON "ResearchConsentEvent"("reference");

-- CreateIndex
CREATE INDEX "ResearchRateLimit_resetAt_idx" ON "ResearchRateLimit"("resetAt");

