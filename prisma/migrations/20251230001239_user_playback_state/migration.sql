-- CreateTable
CREATE TABLE "UserPlaybackState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastVideoId" TEXT,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlaybackState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPlaybackState_userId_key" ON "UserPlaybackState"("userId");

-- CreateIndex
CREATE INDEX "UserPlaybackState_lastVideoId_idx" ON "UserPlaybackState"("lastVideoId");

-- AddForeignKey
ALTER TABLE "UserPlaybackState" ADD CONSTRAINT "UserPlaybackState_lastVideoId_fkey" FOREIGN KEY ("lastVideoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
