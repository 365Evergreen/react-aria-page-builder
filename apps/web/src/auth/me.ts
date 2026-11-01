import { apiFetch } from "../lib/auth";

export interface Me {
  authenticated: boolean;
  email?: string;
  role?: "admin" | "editor";
}

export const fetchMe = (): Promise<Me> =>
  apiFetch("/api/auth/me").then((r) => (r.ok ? (r.json() as Promise<Me>) : { authenticated: false }));
