-- Migration: 0010_backfill_media_from_uploads.sql
-- Backfills the `media` table from the legacy `uploads` table so that
-- existing R2 objects have proper metadata rows.
--
-- Column mapping:
--   uploads.key          -> media.r2_key
--   uploads.filename     -> media.filename
--   uploads.content_type -> media.content_type
--   uploads.size         -> media.size_bytes
--   uploads.created_at   -> media.created_at (epoch ms -> ISO 8601 string)
--
-- Applied to D1 database d420d8f1-bae9-4ff8-9eb8-7ceed2b2c7a2 (paulibaby)
-- on 2026-10-31. 3 rows backfilled.

INSERT OR IGNORE INTO media (r2_key, filename, content_type, size_bytes, created_at, updated_at)
SELECT
    key,
    filename,
    content_type,
    size,
    strftime('%Y-%m-%dT%H:%M:%SZ', created_at / 1000, 'unixepoch'),
    strftime('%Y-%m-%dT%H:%M:%SZ', created_at / 1000, 'unixepoch')
FROM uploads
WHERE key NOT IN (SELECT r2_key FROM media);
