/**
 * paulibaby-blog-dev Worker — Blog API + Admin Panel
 *
 * Auth routes (public):
 *   POST /api/auth/login    → email + password → { token, user }
 *   POST /api/auth/logout   → invalidate current session
 *   GET  /api/auth/me       → current identity (or { authenticated: false })
 *   GET  /api/auth/status   → { needsSetup } (true when no users exist)
 *   POST /api/auth/setup    → create first admin (only works if no users exist)
 *
 * Admin routes (require Bearer session token):
 *   GET  /api/admin/users       → list users
 *   POST /api/admin/users       → create user (email, password, role)
 *   DELETE /api/admin/users/:id → delete user
 *   ...plus all existing post/media/category endpoints
 *
 * Public routes:
 *   GET  /api/posts        → list published posts
 *   GET  /api/posts/:slug   → get single post
 *   GET  /api/pages/:slug   → get single published page (slug or numeric id) with its template
 *
 * R2: media lives in media (paulibaby-blog-uploads), served at media.paulibaby.com.
 */

import {
  getIdentity,
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  type AuthEnv,
 
} from "./accessAuth";

export interface Env extends AuthEnv {
  DB: D1Database;
  media: R2Bucket;
  CONTENT: R2Bucket;
  ASSETS: Fetcher;
}

interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  published: number;
  template_id: number | null;
  template_content: string;
  category_ids: number[];
  categories: { id: number; name: string; slug: string }[];
  created_at: string;
  updated_at: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  created_at: string;
}

type TemplateType = "post" | "page";
type TemplateLayout = "article" | "feature" | "basic";

interface TemplateSchema {
  version: 1;
  layout: TemplateLayout;
  sections: unknown[];
  components?: TemplateComponent[];
}

interface TemplateComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

interface Template {
  id: number;
  name: string;
  template_type: TemplateType;
  schema: string;
  created_at: string;
  updated_at: string;
}

interface TemplateInput {
  name?: unknown;
  template_type?: unknown;
  schema?: unknown;
}

interface Media {
  id: number;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  title: string;
  caption: string;
  description: string;
  tags: string;
  uploaded_by: string;
  source_url: string;
  thumbnail_key: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getPostCategoryIds(db: D1Database, postId: number): Promise<number[]> {
  const rows = await db.prepare(
    "SELECT category_id FROM post_categories WHERE post_id = ?"
  ).bind(postId).all<{ category_id: number }>();
  return rows.results.map((r: { category_id: any; }) => r.category_id);
}

async function getPostCategories(db: D1Database, postId: number): Promise<{ id: number; name: string; slug: string }[]> {
  const rows = await db.prepare(
    `SELECT c.id, c.name, c.slug 
     FROM post_categories pc 
     JOIN categories c ON c.id = pc.category_id 
     WHERE pc.post_id = ? 
     ORDER BY c.id`
  ).bind(postId).all<{ id: number; name: string; slug: string }>();
  return rows.results;
}

async function syncPostCategories(db: D1Database, postId: number, categoryIds: number[]): Promise<void> {
  await db.prepare("DELETE FROM post_categories WHERE post_id = ?").bind(postId).run();
  if (categoryIds.length === 0) return;
  const stmts = categoryIds.map((catId) =>
    db.prepare("INSERT OR IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)")
      .bind(postId, catId)
  );
  await db.batch(stmts);
}

// First category slug for a post (lowest category id), used to build /posts/:category/:slug URLs.
const CATEGORY_SLUG_SQL =
  "(SELECT c.slug FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = p.id ORDER BY c.id LIMIT 1) AS category_slug";

function buildCategoryFilter(categoryParam: string | null): { clause: string; binds: string[] } | null {
  if (!categoryParam) return null;
  const slugs = categoryParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (slugs.length === 0) return null;
  const placeholders = slugs.map(() => "?").join(",");
  return {
    clause: `p.id IN (SELECT pc.post_id FROM post_categories pc JOIN categories c ON pc.category_id = c.id WHERE c.slug IN (${placeholders}))`,
    binds: slugs,
  };
}

function parseTemplateInput(body: TemplateInput): { value: { name: string; templateType: TemplateType; schema: string } } | { error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const templateType = body.template_type;
  const schema = body.schema;

  if (!name) return { error: "Template name is required" };
  if (name.length > 120) return { error: "Template name must be 120 characters or fewer" };
  if (templateType !== "post" && templateType !== "page") return { error: "Template type must be post or page" };
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { error: "Template schema must be an object" };

  const candidate = schema as Partial<TemplateSchema>;
  if (candidate.version !== 1) return { error: "Template schema version must be 1" };
  if (candidate.layout !== "article" && candidate.layout !== "feature" && candidate.layout !== "basic") return { error: "Template layout is invalid" };
  if (!Array.isArray(candidate.sections)) return { error: "Template sections must be an array" };
  const components = candidate.components ?? [];
  if (!Array.isArray(components)) return { error: "Template components must be an array" };
  if (!components.every((component) =>
    component &&
    typeof component === "object" &&
    typeof (component as TemplateComponent).id === "string" &&
    typeof (component as TemplateComponent).type === "string" &&
    /^[A-Za-z][A-Za-z0-9]{0,63}$/.test((component as TemplateComponent).type) &&
    typeof (component as TemplateComponent).props === "object" &&
    !Array.isArray((component as TemplateComponent).props),
  )) return { error: "Template component configuration is invalid" };

  return { value: { name, templateType, schema: JSON.stringify({ ...candidate, components }) } };
}

function formatTemplate(template: Template): Omit<Template, "schema"> & { schema: TemplateSchema } {
  return { ...template, schema: JSON.parse(template.schema) as TemplateSchema };
}

function parsePostTemplate(body: Partial<Post>): { value: { templateId: number | null; content: string } } | { error: string } {
  const templateId = body.template_id ?? null;
  if (templateId !== null && (!Number.isInteger(templateId) || templateId < 1)) return { error: "Template ID is invalid" };
  const content = body.template_content ?? {};
  if (!content || typeof content !== "object" || Array.isArray(content)) return { error: "Template content must be an object" };
  return { value: { templateId, content: JSON.stringify(content) } };
}

function formatPostTemplate(post: Post): Omit<Post, "template_content"> & { template_content: Record<string, unknown> } {
  return { ...post, template_content: JSON.parse(post.template_content || "{}") as Record<string, unknown> };
}

function guessContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp",
    ico: "image/x-icon",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
    flac: "audio/flac", aac: "audio/aac",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", avi: "video/x-msvideo",
    mkv: "video/x-matroska", m4v: "video/mp4",
    pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", csv: "text/csv", json: "application/json", md: "text/markdown",
    zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
    tar: "application/x-tar", gz: "application/gzip",
  };
  return map[ext] || "application/octet-stream";
}

function classifyMediaType(contentType: string, key: string): "audio" | "document" | "image" | "video" | "other" {
  const ct = contentType.toLowerCase();
  const ext = key.split(".").pop()?.toLowerCase() || "";
  if (ct.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp", "ico"].includes(ext)) return "image";
  if (ct.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  if (ct.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (ct.startsWith("text/") || ct.includes("pdf") || ct.includes("msword") || ct.includes("officedocument") ||
    ct.includes("spreadsheet") || ct.includes("presentation") || ct.includes("json") ||
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md"].includes(ext)) return "document";
  return "other";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // ===== AUTH ROUTES (public — no token required) =====

    // --- Login: email + password → session token ---
    if (path === "/api/auth/login" && method === "POST") {
      const body = await request.json() as { email?: string; password?: string };
      if (!body.email || !body.password) return json({ error: "Email and password required" }, 400);

      const user = await env.DB.prepare(
        "SELECT id, email, password_hash, role FROM users WHERE email = ?"
      ).bind(body.email.toLowerCase()).first<{ id: number; email: string; password_hash: string; role: string }>();

      if (!user) return json({ error: "Invalid credentials" }, 401);
      const valid = await verifyPassword(body.password, user.password_hash);
      if (!valid) return json({ error: "Invalid credentials" }, 401);

      const token = await createSession(env.DB, user.id);
      return json({ token, user: { id: user.id, email: user.email, role: user.role } });
    }

    // --- Logout: invalidate the current session ---
    if (path === "/api/auth/logout" && method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ")) {
        await deleteSession(env.DB, auth.slice(7));
      }
      return json({ success: true });
    }

    // --- Who am I? ---
    if (path === "/api/auth/me" && method === "GET") {
      const id = await getIdentity(request, env);
      return json(id ? { authenticated: true, ...id } : { authenticated: false });
    }

    // --- Setup status: lets the sign-in page offer first-account creation ---
    if (path === "/api/auth/status" && method === "GET") {
      const count = await env.DB.prepare("SELECT COUNT(*) as n FROM users").first<{ n: number }>();
      return json({ needsSetup: !count || count.n === 0 });
    }

    // --- First-run setup: create the first admin (only works if no users exist) ---
    if (path === "/api/auth/setup" && method === "POST") {
      const body = await request.json() as { first_name?: string; last_name?: string; email?: string; password?: string };
      const first = body.first_name?.trim() ?? "";
      const last = body.last_name?.trim() ?? "";
      const email = body.email?.trim().toLowerCase() ?? "";
      if (!first || !last) return json({ error: "First and last name required" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Valid email required" }, 400);
      if (!body.password || body.password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

      const hash = await hashPassword(body.password);
      // Single statement so two concurrent requests can't both create a first admin.
      const result = await env.DB.prepare(
        "INSERT INTO users (first_name, last_name, email, password_hash, role) SELECT ?, ?, ?, ?, 'admin' WHERE NOT EXISTS (SELECT 1 FROM users)"
      ).bind(first, last, email, hash).run();
      if (!result.meta.changes) return json({ error: "Setup already complete" }, 403);

      const user = await env.DB.prepare("SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = ?")
        .bind(result.meta.last_row_id).first<User>();
      const token = await createSession(env.DB, user!.id);
      return json({ token, user }, 201);
    }

    // ===== ADMIN GATE: every /api/admin/* route requires a valid session =====
    if (path.startsWith("/api/admin/")) {
      const identity = await getIdentity(request, env);
      if (!identity) return json({ error: "Unauthorized" }, 401);
      // Editors can create and edit content but not permanently delete anything.
      if (identity.role === "editor" && method === "DELETE") return json({ error: "Forbidden" }, 403);

      // Sign-in entry point: send the user on to the app.
      if (path === "/api/admin/login" && method === "GET") {
        const to = url.searchParams.get("redirect") ?? "/admin/dashboard";
        const safe = to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") ? to : "/admin/dashboard";
        return Response.redirect(new URL(safe, url.origin).toString(), 302);
      }
    }

    // ===== PUBLIC API =====

    // --- List published posts ---
    if (path === "/api/posts" && method === "GET") {
      const catFilter = buildCategoryFilter(url.searchParams.get("category"));
      const whereClause = catFilter
        ? `WHERE p.published = 1 AND ${catFilter.clause}`
        : "WHERE p.published = 1";
      const results = await env.DB.prepare(
        `SELECT p.id, p.slug, p.title, p.excerpt, p.cover_image, p.created_at, ${CATEGORY_SLUG_SQL}
         FROM posts p
         ${whereClause}
         ORDER BY p.created_at DESC`
      ).bind(...(catFilter?.binds ?? [])).all();
      const postsWithCats = await Promise.all(
        results.results.map(async (p: any) => ({
          ...p,
          category_ids: await getPostCategoryIds(env.DB, p.id),
          categories: await getPostCategories(env.DB, p.id),
        }))
      );
      return json(postsWithCats);
    }

    // --- Get single post by slug ---
    const publicPageMatch = path.match(/^\/api\/pages\/([^/]+)$/);
    if (publicPageMatch && method === "GET") {
      const key = decodeURIComponent(publicPageMatch[1]);
      const column = /^\d+$/.test(key) ? "id" : "slug";
      const page = await env.DB.prepare(`SELECT * FROM pages WHERE ${column} = ? AND published = 1`).bind(key).first<Post>();
      if (!page) return json({ error: "Not found" }, 404);
      let template: { id: number; template_type: TemplateType; schema: TemplateSchema } | null = null;
      if (page.template_id !== null) {
        const row = await env.DB.prepare("SELECT id, template_type, schema FROM templates WHERE id = ?").bind(page.template_id).first<Template>();
        if (row) template = { id: row.id, template_type: row.template_type, schema: JSON.parse(row.schema) as TemplateSchema };
      }
      return json({ ...formatPostTemplate(page), template });
    }

    const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch && method === "GET") {
      const slug = postMatch[1];
      const post = await env.DB.prepare(
        `SELECT p.*, ${CATEGORY_SLUG_SQL} FROM posts p WHERE p.slug = ? AND p.published = 1`
      ).bind(slug).first<Post>();
      if (!post) return json({ error: "Not found" }, 404);
      post.category_ids = await getPostCategoryIds(env.DB, post.id);
      post.categories = await getPostCategories(env.DB, post.id);
      return json(post);
    }

    // ===== ADMIN API =====

    // --- User management (admin-only; editors blocked by DELETE gate above for DELETE,
    //     but we also restrict POST to admins) ---
    if (path === "/api/admin/users" && method === "GET") {
      const identity = await getIdentity(request, env);
      if (identity!.role !== "admin") return json({ error: "Forbidden" }, 403);
      const results = await env.DB.prepare(
        "SELECT id, first_name, last_name, email, role, created_at FROM users ORDER BY created_at ASC"
      ).all<User>();
      return json(results.results);
    }

    if (path === "/api/admin/users" && method === "POST") {
      const identity = await getIdentity(request, env);
      if (identity!.role !== "admin") return json({ error: "Forbidden" }, 403);
      const body = await request.json() as { first_name?: string; last_name?: string; email?: string; password?: string; role?: string };
      const first = body.first_name?.trim();
      const last = body.last_name?.trim();
      const email = body.email?.trim().toLowerCase();
      if (!first || !last || !email || !body.password) return json({ error: "First name, last name, email and password required" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email address" }, 400);
      if (body.password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      if (body.role !== "admin" && body.role !== "editor") return json({ error: "Role must be admin or editor" }, 400);

      const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
      if (existing) return json({ error: "Email already registered" }, 409);

      const hash = await hashPassword(body.password);
      const result = await env.DB.prepare(
        "INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
      ).bind(first, last, email, hash, body.role).run();
      const user = await env.DB.prepare("SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = ?")
        .bind(result.meta.last_row_id).first<User>();
      return json(user, 201);
    }

    const userDeleteMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
    if (userDeleteMatch && method === "DELETE") {
      const identity = await getIdentity(request, env);
      if (identity!.role !== "admin") return json({ error: "Forbidden" }, 403);
      const id = parseInt(userDeleteMatch[1]);
      if (id === identity!.id) return json({ error: "Cannot delete yourself" }, 400);
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return json({ success: true });
    }

    // --- Admin: list all posts ---
    if (path === "/api/admin/posts" && method === "GET") {
      const catFilter = buildCategoryFilter(url.searchParams.get("category"));
      const whereClause = catFilter ? `WHERE ${catFilter.clause}` : "";
      const results = await env.DB.prepare(
        `SELECT p.*, ${CATEGORY_SLUG_SQL} FROM posts p ${whereClause} ORDER BY p.created_at DESC`
      ).bind(...(catFilter?.binds ?? [])).all();
      const postsWithCats = await Promise.all(
        results.results.map(async (p: any) => ({
          ...p,
          category_ids: await getPostCategoryIds(env.DB, p.id),
        }))
      );
      return json(postsWithCats);
    }

    // --- Admin: create post ---
    if (path === "/api/admin/posts" && method === "POST") {
      const body = await request.json() as Partial<Post> & { category_ids?: number[] };
      const slug = body.slug || slugify(body.title || "untitled");
      const template = parsePostTemplate(body);
      if ("error" in template) return json({ error: template.error }, 400);
      if (template.value.templateId !== null) {
        const found = await env.DB.prepare("SELECT id FROM templates WHERE id = ?").bind(template.value.templateId).first();
        if (!found) return json({ error: "Template not found" }, 400);
      }
      const existing = await env.DB.prepare("SELECT id FROM posts WHERE slug = ?").bind(slug).first();
      if (existing) return json({ error: "A post with this slug already exists" }, 409);
      const result = await env.DB.prepare(
        "INSERT INTO posts (slug, title, excerpt, body, cover_image, published, template_id, template_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        slug,
        body.title || "",
        body.excerpt || "",
        body.body || "",
        body.cover_image || null,
        body.published ? 1 : 0,
        template.value.templateId,
        template.value.content,
      ).run();
      const newId = result.meta.last_row_id as number;
      const categoryIds = body.category_ids || [];
      if (categoryIds.length > 0) {
        await syncPostCategories(env.DB, newId, categoryIds);
      }
      return json({ id: newId, slug, category_ids: categoryIds }, 201);
    }

    // --- Admin: get / update / delete post by ID ---
    const adminPostMatch = path.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (adminPostMatch) {
      const id = parseInt(adminPostMatch[1]);

      if (method === "GET") {
        const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ?")
          .bind(id).first<Post>();
        if (!post) return json({ error: "Not found" }, 404);
        post.category_ids = await getPostCategoryIds(env.DB, id);
        return json(formatPostTemplate(post));
      }

      if (method === "PUT") {
        const body = await request.json() as Partial<Post> & { category_ids?: number[] };
        const slug = body.slug || slugify(body.title || "untitled");
        const template = parsePostTemplate(body);
        if ("error" in template) return json({ error: template.error }, 400);
        if (template.value.templateId !== null) {
          const found = await env.DB.prepare("SELECT id FROM templates WHERE id = ?").bind(template.value.templateId).first();
          if (!found) return json({ error: "Template not found" }, 400);
        }
        const clash = await env.DB.prepare("SELECT id FROM posts WHERE slug = ? AND id != ?").bind(slug, id).first();
        if (clash) return json({ error: "A post with this slug already exists" }, 409);
        await env.DB.prepare(
          "UPDATE posts SET slug = ?, title = ?, excerpt = ?, body = ?, cover_image = ?, published = ?, template_id = ?, template_content = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(
          slug,
          body.title || "",
          body.excerpt || "",
          body.body || "",
          body.cover_image || null,
          body.published ? 1 : 0,
          template.value.templateId,
          template.value.content,
          id
        ).run();
        await syncPostCategories(env.DB, id, body.category_ids || []);
        return json({ success: true });
      }

      if (method === "PATCH") {
        const body = await request.json() as { published?: number };
        if (![0, 1, 3].includes(Number(body.published))) {
          return json({ error: "published must be 0, 1 or 3" }, 400);
        }
        const result = await env.DB.prepare(
          "UPDATE posts SET published = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(Number(body.published), id).run();
        if (!result.meta.changes) return json({ error: "Not found" }, 404);
        return json({ success: true, published: Number(body.published) });
      }

      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
        return json({ success: true });
      }
    }

    // --- Admin: list pages ---
    if (path === "/api/admin/pages" && method === "GET") {
      const results = await env.DB.prepare("SELECT * FROM pages ORDER BY created_at DESC").all();
      return json(results.results);
    }

    // --- Admin: create page ---
    if (path === "/api/admin/pages" && method === "POST") {
      const body = await request.json() as Partial<Post>;
      const slug = body.slug || slugify(body.title || "untitled");
      const template = parsePostTemplate(body);
      if ("error" in template) return json({ error: template.error }, 400);
      if (template.value.templateId !== null) {
        const found = await env.DB.prepare("SELECT id FROM templates WHERE id = ?").bind(template.value.templateId).first();
        if (!found) return json({ error: "Template not found" }, 400);
      }
      const existing = await env.DB.prepare("SELECT id FROM pages WHERE slug = ?").bind(slug).first();
      if (existing) return json({ error: "A page with this slug already exists" }, 409);
      const result = await env.DB.prepare(
        "INSERT INTO pages (slug, title, excerpt, body, cover_image, published, template_id, template_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        slug,
        body.title || "",
        body.excerpt || "",
        body.body || "",
        body.cover_image || null,
        body.published ? 1 : 0,
        template.value.templateId,
        template.value.content,
      ).run();
      return json({ id: result.meta.last_row_id as number, slug }, 201);
    }

    // --- Admin: get / update / delete page by ID ---
    const adminPageMatch = path.match(/^\/api\/admin\/pages\/(\d+)$/);
    if (adminPageMatch) {
      const id = parseInt(adminPageMatch[1]);

      if (method === "GET") {
        const page = await env.DB.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first<Post>();
        if (!page) return json({ error: "Not found" }, 404);
        return json(formatPostTemplate(page));
      }

      if (method === "PUT") {
        const body = await request.json() as Partial<Post>;
        const slug = body.slug || slugify(body.title || "untitled");
        const template = parsePostTemplate(body);
        if ("error" in template) return json({ error: template.error }, 400);
        if (template.value.templateId !== null) {
          const found = await env.DB.prepare("SELECT id FROM templates WHERE id = ?").bind(template.value.templateId).first();
          if (!found) return json({ error: "Template not found" }, 400);
        }
        const clash = await env.DB.prepare("SELECT id FROM pages WHERE slug = ? AND id != ?").bind(slug, id).first();
        if (clash) return json({ error: "A page with this slug already exists" }, 409);
        const result = await env.DB.prepare(
          "UPDATE pages SET slug = ?, title = ?, excerpt = ?, body = ?, cover_image = ?, published = ?, template_id = ?, template_content = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(
          slug,
          body.title || "",
          body.excerpt || "",
          body.body || "",
          body.cover_image || null,
          body.published ? 1 : 0,
          template.value.templateId,
          template.value.content,
          id
        ).run();
        if (!result.meta.changes) return json({ error: "Not found" }, 404);
        return json({ success: true });
      }

      if (method === "PATCH") {
        const body = await request.json() as { published?: number };
        if (![0, 1, 3].includes(Number(body.published))) {
          return json({ error: "published must be 0, 1 or 3" }, 400);
        }
        const result = await env.DB.prepare(
          "UPDATE pages SET published = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(Number(body.published), id).run();
        if (!result.meta.changes) return json({ error: "Not found" }, 404);
        return json({ success: true, published: Number(body.published) });
      }

      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id).run();
        return json({ success: true });
      }
    }

    // --- Admin: upload image to R2 (legacy) ---
    if (path === "/api/admin/upload" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) return json({ error: "No file provided" }, 400);

      const key = `${Date.now()}-${file.name}`;
      await env.media.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      return json({
        key,
        url: `https://media.paulibaby.com/${key}`,
      }, 201);
    }

    // --- Admin: list R2 objects (legacy) ---
    if (path === "/api/admin/upload" && method === "GET") {
      const listed = await env.media.list();
      const objects = listed.objects.map((obj: { key: any; size: any; uploaded: { toISOString: () => any; }; }) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        url: `https://media.paulibaby.com/${obj.key}`,
      }));
      return json(objects);
    }

    // --- Admin: media library ---

    if (path === "/api/admin/media" && method === "GET") {
      const results = await env.DB.prepare(
        "SELECT * FROM media ORDER BY created_at DESC"
      ).all();
      return json(results.results);
    }

    if (path === "/api/admin/media" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) return json({ error: "No file provided" }, 400);

      const MAX_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_SIZE) return json({ error: "Maximum file size is 50MB" }, 400);

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const key = `${Date.now()}-${safeName}`;

      await env.media.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      const altText = formData.get("alt_text");
      const title = formData.get("title");
      const caption = formData.get("caption");
      const description = formData.get("description");
      const tags = formData.get("tags");
      const uploadedBy = formData.get("uploaded_by");

      const result = await env.DB.prepare(
        `INSERT INTO media (r2_key, filename, content_type, size_bytes, alt_text, title, caption, description, tags, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        key,
        file.name,
        file.type,
        file.size,
        typeof altText === "string" ? altText : "",
        typeof title === "string" ? title : "",
        typeof caption === "string" ? caption : "",
        typeof description === "string" ? description : "",
        typeof tags === "string" ? tags : "",
        typeof uploadedBy === "string" ? uploadedBy : ""
      ).run();

      const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?")
        .bind(result.meta.last_row_id).first<Media>();
      return json(media, 201);
    }

    const mediaMatch = path.match(/^\/api\/admin\/media\/(\d+)$/);
    if (mediaMatch) {
      const id = parseInt(mediaMatch[1]);

      if (method === "GET") {
        const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?")
          .bind(id).first<Media>();
        if (!media) return json({ error: "Media not found" }, 404);
        return json(media);
      }

      if (method === "PUT") {
        const body = await request.json() as Partial<Media>;
        const fields = ["alt_text", "title", "caption", "description", "tags"] as const;
        const updates: string[] = [];
        const values: string[] = [];
        for (const f of fields) {
          if (typeof body[f] === "string") {
            updates.push(`${f} = ?`);
            values.push(body[f] as string);
          }
        }
        if (updates.length === 0) return json({ error: "No updatable fields provided" }, 400);
        updates.push("updated_at = datetime('now')");
        values.push(String(id));
        await env.DB.prepare(`UPDATE media SET ${updates.join(", ")} WHERE id = ?`)
          .bind(...values).run();
        const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?")
          .bind(id).first<Media>();
        return json(media);
      }

      if (method === "DELETE") {
        const media = await env.DB.prepare(
          "SELECT r2_key, thumbnail_key FROM media WHERE id = ?"
        ).bind(id).first<{ r2_key: string; thumbnail_key: string | null }>();
        if (!media) return json({ error: "Media not found" }, 404);

        await env.media.delete(media.r2_key);
        if (media.thumbnail_key) {
          try { await env.media.delete(media.thumbnail_key); } catch (e) { /* ignore */ }
        }
        await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(id).run();
        return json({ success: true });
      }
    }

    if (path === "/api/admin/auth-check" && method === "GET") {
      return json({ authenticated: true });
    }

    // --- Admin: media library (all R2 objects merged with D1 metadata) ---
    if (path === "/api/admin/media-library" && method === "GET") {
      const dbRows = await env.DB.prepare("SELECT * FROM media").all<Media>();
      const dbMap = new Map<string, Media>();
      for (const row of dbRows.results) {
        dbMap.set(row.r2_key, row);
      }

      const allObjects: { key: string; size: number; uploaded: Date; etag: string; httpMetadata?: { contentType?: string } }[] = [];
      let cursor: string | undefined;
      do {
        const listed = await env.media.list({ cursor });
        for (const obj of listed.objects) {
          allObjects.push({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded,
            etag: obj.etag,
            httpMetadata: obj.httpMetadata as { contentType?: string } | undefined,
          });
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      const items = allObjects.map((obj) => {
        const dbRow = dbMap.get(obj.key);
        const contentType = dbRow?.content_type || obj.httpMetadata?.contentType || guessContentType(obj.key);
        return {
          id: dbRow?.id ?? null,
          r2_key: obj.key,
          filename: dbRow?.filename || obj.key.split("/").pop() || obj.key,
          content_type: contentType,
          media_type: classifyMediaType(contentType, obj.key),
          size_bytes: dbRow?.size_bytes ?? obj.size,
          width: dbRow?.width ?? null,
          height: dbRow?.height ?? null,
          alt_text: dbRow?.alt_text ?? "",
          title: dbRow?.title ?? "",
          caption: dbRow?.caption ?? "",
          description: dbRow?.description ?? "",
          tags: dbRow?.tags ?? "",
          uploaded_by: dbRow?.uploaded_by ?? "",
          source_url: dbRow?.source_url ?? "",
          thumbnail_key: dbRow?.thumbnail_key ?? "",
          created_at: dbRow?.created_at ?? obj.uploaded.toISOString(),
          updated_at: dbRow?.updated_at ?? "",
          url: `https://media.paulibaby.com/${obj.key}`,
        };
      });

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return json(items);
    }

    if (path === "/api/admin/media-library" && method === "DELETE") {
      const body = await request.json() as { r2_key: string };
      if (!body.r2_key) return json({ error: "r2_key is required" }, 400);

      await env.media.delete(body.r2_key);
      await env.DB.prepare("DELETE FROM media WHERE r2_key = ?").bind(body.r2_key).run();
      return json({ success: true });
    }

    // --- Admin: categories ---
    if (path === "/api/admin/categories" && method === "GET") {
      const results = await env.DB.prepare(
        "SELECT * FROM categories ORDER BY name ASC"
      ).all<Category>();
      return json(results.results);
    }

    if (path === "/api/admin/categories" && method === "POST") {
      const body = await request.json() as { name: string; parent_id?: number | null };
      if (!body.name || !body.name.trim()) {
        return json({ error: "Category name is required" }, 400);
      }
      const slug = slugify(body.name);
      const existing = await env.DB.prepare("SELECT id FROM categories WHERE slug = ?")
        .bind(slug).first();
      if (existing) {
        return json({ error: "A category with that slug already exists" }, 409);
      }
      const result = await env.DB.prepare(
        "INSERT INTO categories (name, slug, parent_id) VALUES (?, ?, ?)"
      ).bind(
        body.name.trim(),
        slug,
        body.parent_id || null
      ).run();
      const category = await env.DB.prepare("SELECT * FROM categories WHERE id = ?")
        .bind(result.meta.last_row_id).first<Category>();
      return json(category, 201);
    }

    // --- Admin: templates ---
    if (path === "/api/admin/templates" && method === "GET") {
      const results = await env.DB.prepare(
        "SELECT * FROM templates ORDER BY updated_at DESC, id DESC"
      ).all<Template>();
      return json(results.results.map(formatTemplate));
    }

    if (path === "/api/admin/templates" && method === "POST") {
      const input = parseTemplateInput(await request.json() as TemplateInput);
      if ("error" in input) return json({ error: input.error }, 400);

      const result = await env.DB.prepare(
        "INSERT INTO templates (name, template_type, schema) VALUES (?, ?, ?)"
      ).bind(input.value.name, input.value.templateType, input.value.schema).run();
      const template = await env.DB.prepare("SELECT * FROM templates WHERE id = ?")
        .bind(result.meta.last_row_id).first<Template>();
      return json(formatTemplate(template!), 201);
    }

    const templateMatch = path.match(/^\/api\/admin\/templates\/(\d+)$/);
    if (templateMatch && method === "PUT") {
      const input = parseTemplateInput(await request.json() as TemplateInput);
      if ("error" in input) return json({ error: input.error }, 400);

      const id = parseInt(templateMatch[1]);
      const result = await env.DB.prepare(
        "UPDATE templates SET name = ?, template_type = ?, schema = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(input.value.name, input.value.templateType, input.value.schema, id).run();
      if (result.meta.changes === 0) return json({ error: "Template not found" }, 404);
      const template = await env.DB.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first<Template>();
      return json(formatTemplate(template!));
    }

    const categoryMatch = path.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (categoryMatch && method === "DELETE") {
      const catId = parseInt(categoryMatch[1]);
      await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(catId).run();
      return json({ success: true });
    }

    // ===== Fallback: serve static assets (SPA) =====
    return env.ASSETS.fetch(request);
  },
};
