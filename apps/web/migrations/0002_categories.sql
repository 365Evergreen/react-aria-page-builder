-- Categories table (self-referencing for hierarchy)
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id INTEGER DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Add category FK to posts (single category per post, nullable)
ALTER TABLE posts ADD COLUMN category_id INTEGER DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);

-- Seed a few sample categories (safe to re-run)
INSERT OR IGNORE INTO categories (name, slug, parent_id) VALUES
  ('Technology', 'technology', NULL),
  ('Lifestyle',  'lifestyle',  NULL);

INSERT OR IGNORE INTO categories (name, slug, parent_id)
  SELECT 'Cloud Computing', 'cloud-computing', id FROM categories WHERE slug = 'technology';
