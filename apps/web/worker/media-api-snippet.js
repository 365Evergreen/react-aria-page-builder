// ---- Media library API endpoints ----
// Add these blocks to your Worker's fetch handler (index.js),
// before the final `return env.ASSETS.fetch(request);` line.
// They use the existing `env.DB` (D1) and `env.BUCKET` (R2) bindings
// and the existing `json()` / `error()` helpers.

// 1. LIST all media — GET /api/admin/media
if (path === "/api/admin/media" && method === "GET") {
  const results = await env.DB.prepare(
    `SELECT * FROM media ORDER BY created_at DESC`
  ).all();
  return json(results.results);
}

// 2. UPLOAD — POST /api/admin/media  (multipart/form-data with "file" + optional text fields)
if (path === "/api/admin/media" && method === "POST") {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return error("No file provided");
  if (!file.type.startsWith("image/")) return error("Only image uploads are allowed");

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) return error("Maximum file size is 10MB");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const key = `${Date.now()}-${safeName}`;

  await env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type }
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
    .bind(result.meta.last_row_id).first();
  return json(media, 201);
}

// 3. GET / PUT / DELETE single media — /api/admin/media/:id
const mediaMatch = path.match(/^\/api\/admin\/media\/(\d+)$/);
if (mediaMatch) {
  const id = Number(mediaMatch[1]);
  if (!Number.isInteger(id) || id < 1) return error("Invalid media id");

  if (method === "GET") {
    const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?")
      .bind(id).first();
    if (!media) return error("Media not found", 404);
    return json(media);
  }

  if (method === "PUT") {
    const body = await request.json();
    const fields = ["alt_text", "title", "caption", "description", "tags"];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (typeof body[f] === "string") {
        updates.push(`${f} = ?`);
        values.push(body[f]);
      }
    }
    if (updates.length === 0) return error("No updatable fields provided");
    updates.push("updated_at = datetime('now')");
    values.push(id);
    await env.DB.prepare(`UPDATE media SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values).run();
    const media = await env.DB.prepare("SELECT * FROM media WHERE id = ?")
      .bind(id).first();
    return json(media);
  }

  if (method === "DELETE") {
    const media = await env.DB.prepare("SELECT r2_key, thumbnail_key FROM media WHERE id = ?")
      .bind(id).first();
    if (!media) return error("Media not found", 404);

    // Delete the file from R2
    await env.BUCKET.delete(media.r2_key);
    if (media.thumbnail_key) {
      try { await env.BUCKET.delete(media.thumbnail_key); } catch (e) {}
    }
    await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(id).run();
    return json({ success: true });
  }
}
