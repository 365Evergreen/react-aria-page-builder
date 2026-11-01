-- Migration: 0009_media.sql
-- Creates the `media` table for storing R2 upload metadata.
-- This table is referenced by the worker's /api/admin/media, /api/admin/media/:id,
-- and /api/admin/media-library endpoints.
--
-- Applied to D1 database d420d8f1-bae9-4ff8-9eb8-7ceed2b2c7a2 (paulibaby)
-- on 2026-10-31.

CREATE TABLE IF NOT EXISTS media (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    r2_key        TEXT NOT NULL UNIQUE,
    filename      TEXT NOT NULL DEFAULT '',
    content_type  TEXT NOT NULL DEFAULT '',
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    width         INTEGER,
    height        INTEGER,
    alt_text      TEXT NOT NULL DEFAULT '',
    title         TEXT NOT NULL DEFAULT '',
    caption       TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    tags          TEXT NOT NULL DEFAULT '',
    uploaded_by   TEXT NOT NULL DEFAULT '',
    source_url    TEXT NOT NULL DEFAULT '',
    thumbnail_key TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_r2_key ON media(r2_key);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
