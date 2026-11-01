/**
 * src/lib/useAuth.ts — React hook for auth state management.
 *
 * Usage:
 *   const { user, loading, login, logout, refresh } = useAuth();
 */

import { useEffect, useState, useCallback, useContext, createContext, type ReactNode } from "react";
import {
  type AuthUser,
  getToken,
  getStoredUser,
  clearSession,
  login as apiLogin,
  logout as apiLogout,
  checkSession,
} from "./auth";

// ---------- Context ----------

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------- Provider ----------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [loading, setLoading] = useState(true);

  // Validate the stored session on mount
  useEffect(() => {
    let active = true;
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      const valid = await checkSession();
      if (!active) return;
      if (valid) {
        setUser(valid);
      } else {
        clearSession();
        setUser(null);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const u = await checkSession();
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------- Hook ----------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
