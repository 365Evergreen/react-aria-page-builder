import { apiFetch } from "./lib/auth";
export interface PostMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: "draft" | "published";
  cover_key: string | null;
  created_at: number;
  updated_at: number;
  published_at: number | null;
}

export type Doc = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    credentials: "same-origin",
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json", ...init.headers }
        : init?.headers,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const api = {
  posts: () => request<{ posts: PostMeta[] }>("/api/posts"),
  post: (slug: string) =>
    request<{ post: PostMeta; content: Doc }>(
      `/api/posts/${encodeURIComponent(slug)}`,
    ),
  me: () => request<{ authenticated: boolean }>("/api/auth/me"),
  login: (password: string) =>
    request<{ ok: true }>("/api/auth/login", json("POST", { password })),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  admin: {
    posts: () => request<{ posts: PostMeta[] }>("/api/admin/posts"),
    post: (id: string) =>
      request<{ post: PostMeta; content: Doc }>(`/api/admin/posts/${id}`),
    create: (input: PostInput) =>
      request<{ id: string; slug: string }>(
        "/api/admin/posts",
        json("POST", input),
      ),
    update: (id: string, input: PostInput) =>
      request<{ id: string; slug: string }>(
        `/api/admin/posts/${id}`,
        json("PUT", input),
      ),
    remove: (id: string) =>
      request<{ ok: true }>(`/api/admin/posts/${id}`, { method: "DELETE" }),
    upload: async (file: File) => {
      const body = new FormData();
      body.set("file", file);
      return (
        await request<{ url: string }>("/api/admin/media", {
          method: "POST",
          body,
        })
      ).url;
    },
  },
};

export interface PostInput {
  title?: string;
  slug?: string;
  excerpt?: string;
  status?: "draft" | "published";
  coverKey?: string | null;
  content?: Doc;
}

export const formatDate = (ms: number | null) =>
  ms
    ? new Date(ms).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
