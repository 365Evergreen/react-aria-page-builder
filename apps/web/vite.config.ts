import { copyFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(appRoot, '../..');

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

const sha256 = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

const embedManifest = (): Plugin => ({
  name: 'editor-embed-manifest',
  apply: 'build',
  generateBundle() {
    const declarations = [
      ['editor.d.ts', resolve(appRoot, 'src/editor/embed.d.ts')],
      ['schema.d.ts', resolve(appRoot, 'src/editor/schema-entry.d.ts')],
      ['renderer.d.ts', resolve(appRoot, 'src/editor/renderer-entry.d.ts')],
    ].map(([fileName, sourcePath]) => ({
      fileName,
      source: readFileSync(sourcePath),
    }));
    for (const declaration of declarations) {
      this.emitFile({ type: 'asset', fileName: declaration.fileName, source: declaration.source });
    }
  },
  writeBundle(_options, bundle) {
    const outputDirectory = resolve(appRoot, 'dist-embed');
    const rendererEditorOnlyCopy = [
      'Block inspector',
      'Block library',
      'Move down',
      'Undo restores',
    ];
    const visited = new Set<string>();
    const checkRendererChunk = (fileName: string) => {
      if (visited.has(fileName)) return;
      visited.add(fileName);
      const output = bundle[fileName];
      if (!output || output.type !== 'chunk') return;
      const leakedCopy = rendererEditorOnlyCopy.find((text) => output.code.includes(text));
      if (leakedCopy) {
        throw new Error(`Read-only renderer bundle includes editor UI copy "${leakedCopy}" in ${fileName}.`);
      }
      [...output.imports, ...output.dynamicImports].forEach(checkRendererChunk);
    };
    checkRendererChunk('renderer.js');

    const files: string[] = [];
    const visit = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const path = resolve(directory, name);
        if (statSync(path).isDirectory()) visit(path);
        else if (name !== 'manifest.json') files.push(path);
      }
    };
    visit(outputDirectory);
    const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    const sourceDirty = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim().length > 0;

    const manifest = {
      format: 'react-aria-page-builder-embed',
      artifactVersion: 1,
      sourceRevision,
      sourceDirty,
      schemaVersion: 1,
      assets: files.sort().map((path) => {
        const source = readFileSync(path);
        return {
          path: path.slice(outputDirectory.length + 1).replace(/\\/g, '/'),
          sha256: sha256(source),
          size: source.byteLength,
        };
      }),
    };
    writeFileSync(resolve(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));
  },
});

export default defineConfig(({ mode }) => {
  const embed = mode === 'embed';
  return {
    base: embed ? './' : process.env.VITE_BASE_PATH ?? '/',
    ...(embed ? { define: { 'process.env.NODE_ENV': JSON.stringify('production') } } : {}),
    plugins: embed
      ? [react(), embedManifest()]
      : [react(), spaFallback()],
    ...(embed
      ? {
          build: {
            outDir: 'dist-embed',
            emptyOutDir: true,
            cssCodeSplit: true,
            lib: {
              entry: {
                editor: resolve(appRoot, 'src/editor/embed.tsx'),
                schema: resolve(appRoot, 'src/editor/schema-entry.ts'),
                renderer: resolve(appRoot, 'src/editor/renderer-entry.ts'),
              },
              formats: ['es'],
            },
            rollupOptions: {
              output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: '[name][extname]',
              },
            },
          },
        }
      : {}),
    preview: {
      port: 4173,
      strictPort: true,
    },
    server: {
      port: 5173,
    },
  };
});
