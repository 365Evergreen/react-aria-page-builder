CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('post', 'page')),
  schema TEXT NOT NULL CHECK (json_valid(schema)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_templates_type_updated ON templates(template_type, updated_at DESC);

INSERT OR IGNORE INTO templates (id, name, template_type, schema) VALUES
  (1, 'Standard post', 'post', '{"version":1,"layout":"article","sections":[]}'),
  (2, 'Feature post', 'post', '{"version":1,"layout":"feature","sections":[]}'),
  (3, 'Basic page', 'page', '{"version":1,"layout":"basic","sections":[]}');
