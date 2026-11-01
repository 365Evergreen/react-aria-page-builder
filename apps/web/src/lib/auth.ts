// src/lib/auth.ts
const TOKEN_KEY = "paulibaby_admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
}

// Use this instead of fetch() for all API calls so the token is attached.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

// Ask the backend whether the stored token is valid.
export async function me(): Promise<{ authenticated: boolean; role?: string; email?: string }> {
  const r = await apiFetch("/api/auth/me");
  if (!r.ok) return { authenticated: false };
  return r.json();
}