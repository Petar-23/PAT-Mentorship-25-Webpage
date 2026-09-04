# Protected PAT publication and Discord delivery

Use the versioned uploader, not production-folder one-off Discord scripts:

```sh
node scripts/hermes-upload.mjs --type advanced_content --file /absolute/path/master.mp4 --title "Verified session title" --date YYYY-MM-DD --playlist "02 - Advanced Content" --module "September 2026" --chapter "Lektionen" --announce
```

`--announce` is explicit per-publication approval. After successful upload/finalize
and optional PDF attachment, it creates a durable announcement queue record.
Rerun the same command/file after interruption; do not use `--force-upload`.
Without `--announce`, upload does not authorize a member post. The Admin UI's
announcement button uses the same queue endpoint. Neither path pings everyone
or any role.

Required production configuration (no fallback to generic Discord variables):

- `DISCORD_MENTORSHIP_GUILD_ID=1179688000809091182`
- `DISCORD_MENTORSHIP_CHANNEL_ID=1457383300946722838`
- Existing `DISCORD_BOT_TOKEN`; existing `CRON_SECRET` for the five-minute worker.

Every send checks the actual channel's guild, bot membership/permissions, hidden
everyone visibility and Mentorship 26 member visibility. A missing or incorrect
configuration blocks delivery. Do not change the general `DISCORD_GUILD_ID`,
which may also serve unrelated integrations.

The Bunny signed status webhook processes **only explicitly requested jobs**.
The authenticated cron retries pending jobs every five minutes, including when
the webhook arrives before the 1080p files are ready. Finalize/status=3 alone is
not readiness: require the app's actual Video→Chapter→Module→Playlist mapping,
HLS master with 1080p, completed variant and a nonempty real segment.

Delivery audit key:
`mentorship-announcement:v1:{videoId}:{guildId}:{channelId}` in AdminSetting.
Queue key: `mentorship-announcement-queue:v1:{videoId}`.
Legacy `announcedAt` is not destination proof. An old message is reused only if
readable in the verified destination with the exact member URL and bot author.
Old wrong-channel messages are not deleted or reposted automatically.

An atomic unique claim plus Discord nonce prevents concurrent sends. There is
no second POST fallback on timeout or thumbnail/DB error. Ambiguous delivery
stays locked and requires reconciliation of the recorded message ID/nonce,
never a blind retry or clearing `announcedAt`. Successful sends require message
readback (channel, author, direct link, no role/everyone ping) before completion.

Authenticated read-only check:
`GET /api/discord/video-announcement?videoId={id}` with existing agent upload
token or admin session. It returns target and delivery audit, not credentials.

Regression suite:
`node --test lib/mentorship-announcement*.test.mjs scripts/hermes-upload.test.mjs`

Official API references: https://docs.discord.com/developers/topics/permissions
and https://docs.discord.com/developers/resources/message (nonce uniqueness is
only short-lived, so it does not replace the durable DB claim).
