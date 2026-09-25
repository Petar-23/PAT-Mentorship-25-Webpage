-- CreateTable
CREATE TABLE "ContractDeclaration" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "confirmationEmail" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "kind" TEXT,
    "reason" TEXT,
    "timing" TEXT,
    "requestedDate" DATE,
    "details" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "statusNote" TEXT,
    "stripeSubscriptionId" TEXT,
    "endsAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractDeclaration_type_receivedAt_idx" ON "ContractDeclaration"("type", "receivedAt");

-- CreateIndex
CREATE INDEX "ContractDeclaration_email_idx" ON "ContractDeclaration"("email");
