-- Blog posts table
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_image TEXT DEFAULT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Index for listing by date
CREATE INDEX IF NOT EXISTS idx_posts_published_date ON posts(published, created_at, published_date DESC);

-- Seed with sample posts
INSERT INTO posts (slug, title, excerpt, body, cover_image, published) VALUES
  ('welcome-to-my-blog',
   'Welcome to my blog',
   'This is the first post on my new blog powered by Cloudflare Workers.',
   '## Welcome!\n\nThis site is powered by **Cloudflare Workers** and **D1** for a seamless content management experience.\n\n### Why Cloudflare Workers?\n\n- Edge-rendered for global speed\n- Zero egress fees with R2 storage\n- D1 database for instant content updates\n- Custom admin panel for visual editing\n\nStay tuned for more posts!',
   'https://media.paulibaby.com/welcome.jpg',
   1),
  ('why-i-moved-to-cloudflare',
   'Why I moved to Cloudflare',
   'Speed, simplicity, and edge computing — here''s why I made the switch.',
   '## The problem\n\nMy old setup was slow and expensive.\n\n## The solution\n\nWith Cloudflare Workers + D1 + R2:\n- **Workers** handle the rendering at the edge\n- **D1** stores my content with instant updates\n- **R2** stores my media with zero egress fees\n\nThe migration was straightforward and the performance improvement is immediately noticeable.',
   'https://media.paulibaby.com/cloudflare.jpg',
   1);
