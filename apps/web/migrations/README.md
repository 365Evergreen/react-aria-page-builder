# paulibaby D1 Migrations — Media Table Fix

## Problem

The `GET /api/admin/media-library` endpoint returned a 500 error because the
worker code queries `SELECT * FROM media`, but the `media` table did not exist
in the D1 database. The migration that the deployed worker code expected was
never applied.

## Root Cause

D1 migrations only went up to `0008_sample_pages.sql`. The worker code (last
updated 2026-10-31) references a `media` table with a rich schema
(`r2_key`, `size_bytes`, `width`, `height`, `alt_text`, etc.), but the only
related table was `uploads` — a simpler legacy table with columns
(`key`, `filename`, `content_type`, `size`, `created_at`) that doesn't match.

## Fix Applied

1. **`0009_media.sql`** — Creates the `media` table with the full column schema
   the deployed worker code expects.

2. **`0010_backfill_media_from_uploads.sql`** — Backfills `media` rows from the
   legacy `uploads` table so existing R2 objects have metadata records. Maps
   `key`→`r2_key`, `size`→`size_bytes`, and converts epoch-ms timestamps to
   ISO 8601 strings.

## Backfilled Rows

| id | r2_key | filename | content_type | size_bytes | created_at |
|----|--------|----------|--------------|------------|------------|
| 1 | 2026/79ac4fcb-b69a-4c0e-90e0-ec1888e4897c.png | modern-workplace.png | image/png | 3,139,686 | 2026-10-30T07:01:27Z |
| 2 | 2026/5c44bce5-673f-416e-a7db-ed4f8e4ee9cd.jpg | Dylan-newport-63-crop.jpg | image/jpeg | 39,889 | 2026-10-30T07:00:23Z |
| 3 | 2026/eeca8689-a8a6-41d8-a043-0b699370b960.jpg | 134359271451137979.jpg | image/jpeg | 2,167,638 | 2026-10-30T07:00:20Z |

## Additional Notes

- The legacy `POST /api/admin/upload` route puts files in R2 but does NOT write
  to the `media` table. Use `POST /api/admin/media` instead, which writes to
  both R2 and `media`.
- The `env.CONTENT` R2 binding (`paulibaby-blog-content`) is configured but
  never used by the worker.
- The `menus` table exists but has no worker routes referencing it.
- The `uploads` table is now superseded by `media` and can be dropped once all
  references are migrated.

## How to Apply

```bash
npx wrangler d1 execute paulibaby --remote --file=migrations/0009_media.sql
npx wrangler d1 execute paulibaby --remote --file=migrations/0010_backfill_media_from_uploads.sql
```

Both migrations have already been applied directly to the production D1
database. These files are provided so your repo stays in sync.
