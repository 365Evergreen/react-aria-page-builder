CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  href TEXT NOT NULL,
  requires_auth INTEGER NOT NULL DEFAULT 0 CHECK (requires_auth IN (0, 1)),
  has_mega_menu INTEGER NOT NULL DEFAULT 0 CHECK (has_mega_menu IN (0, 1)),
  columns TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(columns)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menus_sort_order ON menus(sort_order);
