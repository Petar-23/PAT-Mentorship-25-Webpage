CREATE INDEX IF NOT EXISTS "Module_playlistId_order_idx" ON "Module"("playlistId", "order");
CREATE INDEX IF NOT EXISTS "Module_createdAt_idx" ON "Module"("createdAt");
CREATE INDEX IF NOT EXISTS "Chapter_moduleId_order_idx" ON "Chapter"("moduleId", "order");
CREATE INDEX IF NOT EXISTS "Video_bunnyGuid_idx" ON "Video"("bunnyGuid");
CREATE INDEX IF NOT EXISTS "Video_chapterId_order_idx" ON "Video"("chapterId", "order");
CREATE INDEX IF NOT EXISTS "Video_createdAt_idx" ON "Video"("createdAt");
CREATE INDEX IF NOT EXISTS "VideoProgress_userId_watched_watchedAt_idx" ON "VideoProgress"("userId", "watched", "watchedAt");
CREATE INDEX IF NOT EXISTS "Playlist_createdAt_idx" ON "Playlist"("createdAt");
CREATE INDEX IF NOT EXISTS "Page_order_createdAt_idx" ON "Page"("order", "createdAt");
