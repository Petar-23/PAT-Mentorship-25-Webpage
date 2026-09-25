-- CreateTable
CREATE TABLE "CheckoutFulfillment" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "createdNewUser" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "nonceHash" TEXT,
    "accountClaimedAt" TIMESTAMP(3),
    "ticketIssuedAt" TIMESTAMP(3),
    "welcomeEmailAttemptAt" TIMESTAMP(3),
    "welcomeEmailSentAt" TIMESTAMP(3),
    "duplicateCheckedAt" TIMESTAMP(3),
    "paymentFailedNotifiedAt" TIMESTAMP(3),
    "purchaseTrackedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutFulfillment_stripeSessionId_key" ON "CheckoutFulfillment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "CheckoutFulfillment_userId_idx" ON "CheckoutFulfillment"("userId");

-- CreateIndex
CREATE INDEX "CheckoutFulfillment_email_idx" ON "CheckoutFulfillment"("email");

-- CreateIndex
CREATE INDEX "CheckoutFulfillment_createdAt_idx" ON "CheckoutFulfillment"("createdAt");

