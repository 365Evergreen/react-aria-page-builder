ALTER TABLE posts ADD COLUMN template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN template_content TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(template_content));

CREATE INDEX IF NOT EXISTS idx_posts_template ON posts(template_id);
