import { useEffect, useState } from "react";
import { fetchMe, type Me } from "./me";
import { Navigate, Outlet, useLocation } from "react-router-dom";

/** Sends visitors without an admin/editor session to /sign-in. */
export default function RequireAuth() {
  const [me, setMe] = useState<Me | null>(null);
  const location = useLocation();

  useEffect(() => {
    fetchMe().then(setMe, () => setMe({ authenticated: false }));
  }, []);

  if (!me) return null;
  if (!me.authenticated) return <Navigate to={`/sign-in?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return <Outlet />;
}
