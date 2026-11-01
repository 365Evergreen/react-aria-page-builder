import { apiFetch } from "../lib/auth";
import { useState, useEffect } from "react";

export function useIsAuthenticated(): boolean {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    apiFetch("/api/admin/auth-check")
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false));
  }, []);
  return authed;
}
