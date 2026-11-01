import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves 404.html for unknown paths, so deep links such as
// /editor/my-page load the app instead of a 404 page.
const spaFallback = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
};

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), spaFallback()],
  preview: {
    port: 4173,
    strictPort: true,
  },
  server: {
    port: 5173,
  },
});

