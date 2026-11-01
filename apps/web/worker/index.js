const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
function parseTemplateInput(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const templateType = body.template_type;
  const schema = body.schema;
  if (!name) return { error: "Template name is required" };
  if (name.length > 120) return { error: "Template name must be 120 characters or fewer" };
  if (!["post", "page"].includes(templateType)) return { error: "Template type must be post or page" };
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { error: "Template schema must be an object" };
  if (schema.version !== 1) return { error: "Template schema version must be 1" };
  if (!["article", "feature", "basic"].includes(schema.layout)) return { error: "Template layout is invalid" };
  if (!Array.isArray(schema.sections)) return { error: "Template sections must be an array" };
  return { value: { name, templateType, schema: JSON.stringify(schema) } };
}
function formatTemplate(template) {
  return { ...template, schema: JSON.parse(template.schema) };
}
async function getPostCategoryIds(db, postId) {
  const rows = await db.prepare(
    "SELECT category_id FROM post_categories WHERE post_id = ?"
  ).bind(postId).all();
  return rows.results.map((r) => r.category_id);
}
async function syncPostCategories(db, postId, categoryIds) {
  await db.prepare("DELETE FROM post_categories WHERE post_id = ?").bind(postId).run();
  if (categoryIds.length === 0) return;
  const stmts = categoryIds.map(
    (catId) => db.prepare("INSERT OR IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)").bind(postId, catId)
  );
  await db.batch(stmts);
}
function buildCategoryFilter(categoryParam) {
  if (!categoryParam) return null;
  const slugs = categoryParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (slugs.length === 0) return null;
  const placeholders = slugs.map(() => "?").join(",");
  return {
    clause: `p.id IN (SELECT pc.post_id FROM post_categories pc JOIN categories c ON pc.category_id = c.id WHERE c.slug IN (${placeholders}))`,
    binds: slugs
  };
}
function guessContentType(key) {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    avif: "image/avif",
    bmp: "image/bmp",
    ico: "image/x-icon",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    m4v: "video/mp4",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    md: "text/markdown",
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip"
  };
  return map[ext] || "application/octet-stream";
}
function classifyMediaType(contentType, key) {
  const ct = contentType.toLowerCase();
  const ext = key.split(".").pop()?.toLowerCase() || "";
  if (ct.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp", "ico"].includes(ext)) return "image";
  if (ct.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  if (ct.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (ct.startsWith("text/") || ct.includes("pdf") || ct.includes("msword") || ct.includes("officedocument") || ct.includes("spreadsheet") || ct.includes("presentation") || ct.includes("json") || ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md"].includes(ext)) return "document";
  return "other";
}
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (path === "/api/posts" && method === "GET") {
      const catFilter = buildCategoryFilter(url.searchParams.get("category"));
      const whereClause = catFilter ? `WHERE p.published = 1 AND ${catFilter.clause}` : "WHERE p.published = 1";
      const results = await env.DB.prepare(
        `SELECT p.id, p.slug, p.title, p.excerpt, p.cover_image, p.created_at
         FROM posts p
         ${whereClause}
         ORDER BY p.created_at DESC`
      ).bind(...catFilter?.binds ?? []).all();
      const postsWithCats = await Promise.all(
        results.results.map(async (p) => ({
          ...p,
          category_ids: await getPostCategoryIds(env.DB, p.id)
        }))
      );
      return json(postsWithCats);
    }
    const postMatch = path.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch && method === "GET") {
      const slug = postMatch[1];
      const post = await env.DB.prepare(
        "SELECT * FROM posts WHERE slug = ? AND published = 1"
      ).bind(slug).first();
      if (!post) return json({ error: "Not found" }, 404);
      post.category_ids = await getPostCategoryIds(env.DB, post.id);
      return json(post);
    }
    if (path === "/api/admin/posts" && method === "GET") {
      const catFilter = buildCategoryFilter(url.searchParams.get("category"));
      const whereClause = catFilter ? `WHERE ${catFilter.clause}` : "";
      const results = await env.DB.prepare(
        `SELECT p.* FROM posts p ${whereClause} ORDER BY p.created_at DESC`
      ).bind(...catFilter?.binds ?? []).all();
      const postsWithCats = await Promise.all(
        results.results.map(async (p) => ({
          ...p,
          category_ids: await getPostCategoryIds(env.DB, p.id)
        }))
      );
      return json(postsWithCats);
    }
    if (path === "/api/admin/posts" && method === "POST") {
      const body = await request.json();
      const slug = body.slug || slugify(body.title || "untitled");
      const result = await env.DB.prepare(
        "INSERT INTO posts (slug, title, excerpt, body, cover_image, published) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        slug,
        body.title || "",
        body.excerpt || "",
        body.body || "",
        body.cover_image || null,
        body.published ? 1 : 0
      ).run();
      const newId = result.meta.last_row_id;
      const categoryIds = body.category_ids || [];
      if (categoryIds.length > 0) {
        await syncPostCategories(env.DB, newId, categoryIds);
      }
      return json({ id: newId, slug, category_ids: categoryIds }, 201);
    }
    const adminPostMatch = path.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (adminPostMatch) {
      const id = parseInt(adminPostMatch[1]);
      if (method === "GET") {
        const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
        if (!post) return json({ error: "Not found" }, 404);
        post.category_ids = await getPostCategoryIds(env.DB, id);
        return json(post);
      }
      if (method === "PUT") {
        const body = await request.json();
        const slug = body.slug || slugify(body.title || "untitled");
        await env.DB.prepare(
          "UPDATE posts SET slug = ?, title = ?, excerpt = ?, body = ?, cover_image = ?, published = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(
          slug,
          body.title || "",
          body.excerpt || "",
          body.body || "",
          body.cover_image || null,
          body.published ? 1 : 0,
          id
        ).run();
        await syncPostCategories(env.DB, id, body.category_ids || []);
        return json({ success: true });
      }
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
        return json({ success: true });
      }
    }
    if (path === "/api/admin/upload" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file) return json({ error: "No file provided" }, 400);
      const key = `${Date.now()}-${file.name}`;
      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type }
      });
      return json({
        key,
        url: `https://media.paulibaby.com/${key}`
      }, 201);
    }
    if (path === "/api/admin/upload" && method === "GET") {
      const listed = await env.BUCKET.list();
      const objects = listed.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        url: `https://media.paulibaby.com/${obj.key}`
      }));
      return json(objects);
    }
    if (path === "/api/admin/media" && method === "GET") {
      const filters = [];
      const binds = [];
      for (const col of ["playlist", "subject", "presenter", "group_id", "media_type"]) {
        const val = url.searchParams.get(col);
        if (val) { filters.push(`${col} = ?`); binds.push(val); }
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const results = await env.DB.prepare(
        `SELECT * FROM media ${where} ORDER BY created_at DESC`
      ).bind(...binds).all();
      return json(results.results);
    }
    if (path === "/api/admin/media" && method === "POST") {
      const formData = await request.formData();
      const files = formData.getAll("file").filter(f => f && f.size > 0);
      if (files.length === 0) return json({ error: "No files provided" }, 400);
      const MAX_SIZE = 50 * 1024 * 1024;
      for (const f of files) {
        if (f.size > MAX_SIZE)
          return json({ error: `File ${f.name} exceeds 50MB limit` }, 400);
      }
      const groupId = crypto.randomUUID();
      const shared = {
        playlist: formData.get("playlist") || "",
        subject: formData.get("subject") || "",
        presenter: formData.get("presenter") || "",
        alt_text: formData.get("alt_text") || "",
        title: formData.get("title") || "",
        caption: formData.get("caption") || "",
        description: formData.get("description") || "",
        tags: formData.get("tags") || "",
        uploaded_by: formData.get("uploaded_by") || "",
      };
      let fileMeta = {};
      const raw = formData.get("file_meta");
      if (raw) { try { fileMeta = JSON.parse(raw); } catch (e) { } }
      const uploaded = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const key = `${Date.now()}-${safeName}`;
        await env.BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });
        const per = fileMeta[file.name] || {};
        const result = await env.DB.prepare(
          `INSERT INTO media (r2_key, filename, content_type, size_bytes,
              alt_text, title, caption, description, tags, uploaded_by,
              media_type, playlist, subject, presenter, group_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          key, file.name, file.type, file.size,
          per.alt_text || shared.alt_text,
          per.title || shared.title,
          per.caption || shared.caption,
          per.description || shared.description,
          per.tags || shared.tags,
          per.uploaded_by || shared.uploaded_by,
          classifyMediaType(file.type, file.name),
          per.playlist || shared.playlist,
          per.subject || shared.subject,
          per.presenter || shared.presenter,
          groupId,
        ).run();
        const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?")
          .bind(result.meta.last_row_id).first();
        uploaded.push(media);
      }
      return json({ group_id: groupId, files: uploaded }, 201);
    }
    const mediaMatch = path.match(/^\/api\/admin\/media\/(\d+)$/);
    if (mediaMatch) {
      const id = parseInt(mediaMatch[1]);
      if (method === "GET") {
        const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?").bind(id).first();
        if (!media) return json({ error: "Media not found" }, 404);
        return json(media);
      }
      if (method === "PUT") {
        const body = await request.json();
        const fields = ["alt_text", "title", "caption", "description", "tags", "playlist", "subject", "presenter"];
        const updates = [];
        const values = [];
        for (const f of fields) {
          if (typeof body[f] === "string") {
            updates.push(`${f} = ?`);
            values.push(body[f]);
          }
        }
        if (updates.length === 0) return json({ error: "No updatable fields provided" }, 400);
        updates.push("updated_at = datetime('now')");
        values.push(String(id));
        await env.DB.prepare(`UPDATE media SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
        const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?").bind(id).first();
        return json(media);
      }
      if (method === "DELETE") {
        const media = await env.DB.prepare(
          "SELECT r2_key, thumbnail_key FROM media WHERE id = ?"
        ).bind(id).first();
        if (!media) return json({ error: "Media not found" }, 404);
        await env.BUCKET.delete(media.r2_key);
        if (media.thumbnail_key) {
          try {
            await env.BUCKET.delete(media.thumbnail_key);
          } catch (e) {
          }
        }
        await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(id).run();
        return json({ success: true });
      }
    }
    if (path === "/api/admin/auth-check" && method === "GET") {
      return json({ authenticated: true });
    }
    if (path === "/api/admin/media-library" && method === "GET") {
      const dbRows = await env.DB.prepare("SELECT * FROM media").all();
      const dbMap = /* @__PURE__ */ new Map();
      for (const row of dbRows.results) {
        dbMap.set(row.r2_key, row);
      }
      const allObjects = [];
      let cursor;
      do {
        const listed = await env.BUCKET.list({ cursor });
        for (const obj of listed.objects) {
          allObjects.push({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded,
            etag: obj.etag,
            httpMetadata: obj.httpMetadata
          });
        }
        cursor = listed.truncated ? listed.cursor : void 0;
      } while (cursor);
      const items = allObjects.map((obj) => {
        const dbRow = dbMap.get(obj.key);
        const contentType = dbRow?.content_type || obj.httpMetadata?.contentType || guessContentType(obj.key);
        return {
          id: dbRow?.id ?? null,
          r2_key: obj.key,
          filename: dbRow?.filename || obj.key.split("/").pop() || obj.key,
          content_type: contentType,
          media_type: dbRow?.media_type || classifyMediaType(contentType, obj.key),
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
          playlist: dbRow?.playlist ?? "",
          subject: dbRow?.subject ?? "",
          presenter: dbRow?.presenter ?? "",
          group_id: dbRow?.group_id ?? "",
          created_at: dbRow?.created_at ?? obj.uploaded.toISOString(),
          updated_at: dbRow?.updated_at ?? "",
          url: `https://media.paulibaby.com/${obj.key}`
        };
      });
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return json(items);
    }
    if (path === "/api/admin/media-library" && method === "DELETE") {
      const body = await request.json();
      if (!body.r2_key) return json({ error: "r2_key is required" }, 400);
      await env.BUCKET.delete(body.r2_key);
      await env.DB.prepare("DELETE FROM media WHERE r2_key = ?").bind(body.r2_key).run();
      return json({ success: true });
    }
    if (path === "/api/admin/categories" && method === "GET") {
      const results = await env.DB.prepare(
        "SELECT * FROM categories ORDER BY name ASC"
      ).all();
      return json(results.results);
    }
    if (path === "/api/admin/categories" && method === "POST") {
      const body = await request.json();
      if (!body.name || !body.name.trim()) {
        return json({ error: "Category name is required" }, 400);
      }
      const slug = slugify(body.name);
      const existing = await env.DB.prepare("SELECT id FROM categories WHERE slug = ?").bind(slug).first();
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
      const category = await env.DB.prepare("SELECT * FROM categories WHERE id = ?").bind(result.meta.last_row_id).first();
      return json(category, 201);
    }
    if (path === "/api/admin/templates" && method === "GET") {
      const results = await env.DB.prepare(
        "SELECT * FROM templates ORDER BY updated_at DESC, id DESC"
      ).all();
      return json(results.results.map(formatTemplate));
    }
    if (path === "/api/admin/templates" && method === "POST") {
      const input = parseTemplateInput(await request.json());
      if (input.error) return json({ error: input.error }, 400);
      const result = await env.DB.prepare(
        "INSERT INTO templates (name, template_type, schema) VALUES (?, ?, ?)"
      ).bind(input.value.name, input.value.templateType, input.value.schema).run();
      const template = await env.DB.prepare("SELECT * FROM templates WHERE id = ?").bind(result.meta.last_row_id).first();
      return json(formatTemplate(template), 201);
    }
    const templateMatch = path.match(/^\/api\/admin\/templates\/(\d+)$/);
    if (templateMatch && method === "PUT") {
      const input = parseTemplateInput(await request.json());
      if (input.error) return json({ error: input.error }, 400);
      const id = parseInt(templateMatch[1]);
      const result = await env.DB.prepare(
        "UPDATE templates SET name = ?, template_type = ?, schema = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(input.value.name, input.value.templateType, input.value.schema, id).run();
      if (result.meta.changes === 0) return json({ error: "Template not found" }, 404);
      const template = await env.DB.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first();
      return json(formatTemplate(template));
    }
    const categoryMatch = path.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (categoryMatch && method === "DELETE") {
      const catId = parseInt(categoryMatch[1]);
      await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(catId).run();
      return json({ success: true });
    }
    return env.ASSETS.fetch(request);
  }
};
const workerEntry = worker ?? {};
export {
  workerEntry as default
};
