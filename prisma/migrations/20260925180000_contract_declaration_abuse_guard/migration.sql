-- DropIndex
DROP INDEX "ContractDeclaration_email_idx";

-- AlterTable
ALTER TABLE "ContractDeclaration" ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "mailNote" TEXT;

-- CreateIndex
CREATE INDEX "ContractDeclaration_receivedAt_idx" ON "ContractDeclaration"("receivedAt");

-- CreateIndex
CREATE INDEX "ContractDeclaration_email_receivedAt_idx" ON "ContractDeclaration"("email", "receivedAt");

-- CreateIndex
CREATE INDEX "ContractDeclaration_confirmationEmail_receivedAt_idx" ON "ContractDeclaration"("confirmationEmail", "receivedAt");

-- CreateIndex
CREATE INDEX "ContractDeclaration_ipHash_receivedAt_idx" ON "ContractDeclaration"("ipHash", "receivedAt");
