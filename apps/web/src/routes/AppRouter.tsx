import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const AppShell = lazy(() => import("../layouts/AppShell/AppShell"));
const EditorShell = lazy(() => import("../layouts/EditorShell/EditorShell"));
const Home = lazy(() => import("../pages/HomePage/HomePage"));
const EditorCanvas = lazy(() => import("../EditorCanvas"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div role="status">Loading…</div>}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Home />} />

          </Route>
          <Route path="/editor" element={<EditorShell />} />
          <Route path="/issues" element={<EditorCanvas />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRouter;
