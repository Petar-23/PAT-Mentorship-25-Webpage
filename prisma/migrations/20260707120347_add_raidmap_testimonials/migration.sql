-- CreateTable
CREATE TABLE "RaidMapTestimonial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "RaidMapTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaidMapTestimonial_status_createdAt_idx" ON "RaidMapTestimonial"("status", "createdAt");

