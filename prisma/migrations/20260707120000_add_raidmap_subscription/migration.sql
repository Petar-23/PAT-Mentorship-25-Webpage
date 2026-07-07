-- CreateTable
CREATE TABLE "RaidMapSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tier" TEXT,
    "priceId" TEXT,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidMapSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaidMapSubscription_userId_key" ON "RaidMapSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidMapSubscription_stripeSubscriptionId_key" ON "RaidMapSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "RaidMapSubscription_status_idx" ON "RaidMapSubscription"("status");
