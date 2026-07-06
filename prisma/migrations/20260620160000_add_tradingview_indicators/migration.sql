-- CreateTable
CREATE TABLE "IndicatorPackage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" TEXT NOT NULL,
    "packageId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "detailDescription" TEXT,
    "pineId" TEXT,
    "imageUrl" TEXT,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "tvUsername" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastWorkerId" TEXT,
    "tradingViewResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorClaimAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "indicatorId" TEXT,
    "tvUsername" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorClaimAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTradingViewAccount" (
    "userId" TEXT NOT NULL,
    "tvUsername" TEXT NOT NULL,
    "tvUsernameNormalized" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTradingViewAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "IndicatorWorkerHeartbeat" (
    "workerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "currentClaimId" TEXT,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "grantedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "metadata" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorWorkerHeartbeat_pkey" PRIMARY KEY ("workerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorPackage_slug_key" ON "IndicatorPackage"("slug");

-- CreateIndex
CREATE INDEX "IndicatorPackage_sortOrder_name_idx" ON "IndicatorPackage"("sortOrder", "name");

-- CreateIndex
CREATE INDEX "IndicatorPackage_visible_idx" ON "IndicatorPackage"("visible");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_slug_key" ON "Indicator"("slug");

-- CreateIndex
CREATE INDEX "Indicator_packageId_sortOrder_idx" ON "Indicator"("packageId", "sortOrder");

-- CreateIndex
CREATE INDEX "Indicator_visible_ready_idx" ON "Indicator"("visible", "ready");

-- CreateIndex
CREATE INDEX "Indicator_pineId_idx" ON "Indicator"("pineId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorClaim_userId_indicatorId_key" ON "IndicatorClaim"("userId", "indicatorId");

-- CreateIndex
CREATE INDEX "IndicatorClaim_userId_idx" ON "IndicatorClaim"("userId");

-- CreateIndex
CREATE INDEX "IndicatorClaim_status_nextRetryAt_idx" ON "IndicatorClaim"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "IndicatorClaim_indicatorId_status_idx" ON "IndicatorClaim"("indicatorId", "status");

-- CreateIndex
CREATE INDEX "IndicatorClaimAudit_userId_createdAt_idx" ON "IndicatorClaimAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "IndicatorClaimAudit_indicatorId_createdAt_idx" ON "IndicatorClaimAudit"("indicatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTradingViewAccount_tvUsernameNormalized_key" ON "UserTradingViewAccount"("tvUsernameNormalized");

-- CreateIndex
CREATE INDEX "UserTradingViewAccount_updatedAt_idx" ON "UserTradingViewAccount"("updatedAt");

-- AddForeignKey
ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "IndicatorPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorClaim" ADD CONSTRAINT "IndicatorClaim_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
