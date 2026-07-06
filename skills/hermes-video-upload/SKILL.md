---
name: hermes-video-upload
description: Upload PAT Mentorship Daily Reviews and Advanced Content lessons from a local Mac/PC drive into the platform using the Hermes uploader CLI and secure agent API. Use when Petar asks Hermes to upload, import, publish, or sort local video files into PAT monthly content areas.
---

# Hermes Video Upload

Use this skill when Petar asks to upload local videos from an external drive into the PAT Mentorship platform.

## Target Mapping

- `daily_review`: Upload to playlist `Daily Reviews`, module `<German month> <year>` such as `Juni 2026`, chapter `KW <ISO week>` unless Petar specifies another chapter.
- `advanced_content`: Upload to playlist `Advanced Content`, module `<German month> <year>`, chapter `Lektionen` unless Petar specifies another chapter.
- Videos are appended at the end of the target chapter, preserving chronological order.

## Required Inputs

- Local video path, usually on `/Volumes/...`.
- Content type: `daily_review` or `advanced_content`.
- Title if Petar gives one. If not, let the uploader infer it from the filename.
- Optional date/month. If omitted, the uploader infers date from filename (`YYYY-MM-DD`, `DD-MM-YYYY`, `DD.MM.YYYY`) or file modified time.

## Command

Run from the website repo:

```bash
node scripts/hermes-upload.mjs \
  --type daily_review \
  --file "/Volumes/External/Daily Reviews/2026-06/04-06-2026.mp4" \
  --title "Daily Review 04.06.2026"
```

Advanced lesson:

```bash
node scripts/hermes-upload.mjs \
  --type advanced_content \
  --file "/Volumes/External/Lektionen/2026-06/liquidity-sweep.mp4" \
  --title "Liquidity Sweep Entry Model"
```

The uploader automatically reads `~/.pat-hermes-upload.env` when present.

Useful options:

- `--dry-run`: Resolve the target without creating anything.
- `--prepare-only`: Create platform/Bunny records and print upload metadata, but do not upload the file.
- `--date YYYY-MM-DD`: Force date used for month/week routing.
- `--month YYYY-MM`: Force monthly module.
- `--chapter "KW 23"` or `--chapter "Lektionen"`: Override chapter.
- `--playlist` and `--module`: Override target names.

## Safety Rules

- Never upload without a valid `PAT_UPLOAD_TOKEN`.
- Run `--dry-run` first if the folder/file naming is ambiguous.
- Do not create duplicate uploads manually; rerun the same command instead. The uploader uses an idempotency key derived from file path, size, mtime, and type.
- If a job is already marked uploaded, do not force it unless Petar explicitly asks.

## Success Criteria

After upload, report:

- Target playlist/module/chapter.
- Video title and platform video URL.
- Whether the upload was reused or newly created.
- Any API or Bunny upload error verbatim enough for debugging.
