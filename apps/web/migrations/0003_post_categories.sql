-- Many-to-many junction table for post ↔ category
CREATE TABLE IF NOT EXISTS post_categories (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_post_categories_category ON post_categories(category_id);

-- Migrate existing single-category data into the junction table
INSERT OR IGNORE INTO post_categories (post_id, category_id)
  SELECT id, category_id FROM posts WHERE category_id IS NOT NULL;
