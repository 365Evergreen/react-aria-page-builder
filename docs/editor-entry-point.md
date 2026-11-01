# Editor entry point and separate-repository embedding

The editor repository remains an independently buildable GitHub Pages app. Its standalone `LocalStore` continues to use browser `localStorage`; embedding a release in another application does not merge repositories, share `node_modules`, or replace the host application's HTML, router, authentication, or deployment process.

## Build and pin an embedding release

From a clean editor checkout, build with the repository lockfile:

```powershell
npm ci
npm run build:embed --workspace @page-builder/web
```

The build writes `apps/web/dist-embed/` with an ES module for the editor (`editor.js`), an isolated React read-only renderer (`renderer.js`), a Worker-safe schema validator (`schema.js`), CSS assets, TypeScript declaration files, any shared relative chunks, and `manifest.json`. CSS filenames are emitted per entry/component (for example `editor.css`, `renderer.css`, and `PageDocumentRenderer.css`); load the manifest-listed styles needed by each entry. Copy the complete directory, not only its entry points: every emitted JS/CSS/declaration file appears in `manifest.json`.

The manifest has this shape:

```json
{
  "format": "react-aria-page-builder-embed",
  "artifactVersion": 1,
  "sourceRevision": "<git commit>",
  "sourceDirty": false,
  "schemaVersion": 1,
  "assets": [
    { "path": "editor.js", "sha256": "<hex>", "size": 1234 }
  ]
}
```

`sourceDirty` is true when the source checkout has uncommitted changes. Do not pin such a build as a release. Verify every copied asset against the manifest before installing it; `schema.js` may import a `chunks/` file and must be staged with that file even when the editor and CSS are not used by a Worker.

The host repository remains responsible for recording its pinned `sourceRevision`, artifact manifest/checksum, compatibility decision, and rollback pin. Artifact updates are explicit: build from a clean editor commit, stage all manifest-listed files, verify hashes, run the host's tests, then update the host pin.

## Public module contracts

### Editor

```ts
import { mountEditor } from './editor.js';
import type { DocumentIdentity, PageStore, ThemeColors } from './editor.js';

const storage: PageStore = {
  load: async (identity) => null, // PageStoreSnapshot | null
  save: async (identity, document, options) => ({
    revision: options?.expectedRevision ?? null,
    publishedRevision: null,
  }),
  list: async () => [],
  remove: async () => {},
};

const handle = mountEditor({
  container,
  identity: { kind: 'post', id: 42 },
  storage,
  routeBasePath: '/admin/editor/',
  assetBasePath: '/media/',
  navigate: (href) => hostRouterNavigate(href),
  onDirtyChange: (dirty) => setNavigationGuardEnabled(dirty),
  theme,
});
// host route cleanup
handle.unmount();
```

`MountEditorOptions` also retains `pageId` and `basePath` for existing Pages routes. `routeBasePath` is the host-owned editor index URL; typed document URLs are generated as `/admin/editor/pages/:id` and `/admin/editor/posts/:id`. `assetBasePath` is used only for relative content media. These are deliberately independent. `navigate(href)` lets the host router transition without a full reload; links keep their real `href` for keyboard, context-menu, and open-in-new-tab behavior.

`DocumentIdentity` is `{ kind: 'page' | 'post'; id: string | number }`. Existing standalone string IDs continue to mean pages. The typed store methods use `PageStoreSnapshot`:

```ts
interface PageStoreSnapshot {
  document: PageDocument;
  revision: string | null;
  publishedRevision: string | null;
}

interface PageStoreSaveOptions {
  expectedRevision?: string | null; // null is create-only
}

interface PageStoreSaveResult {
  revision: string | null;
  publishedRevision: string | null;
}
```

Revision data belongs to the storage snapshot/result, never to the canonical `PageDocument` JSON. A remote adapter must send `expectedRevision` on each write, surface revision conflicts as errors, and return the new revision. The editor keeps the working tree and displays save failures instead of silently reporting success. Page and post records must use their persistent host identities, not slugs.

`onDirtyChange(dirty)` is called initially and whenever the current tree changes between clean and dirty. New documents start dirty until their first successful save. Edits, undo/redo, and importing a file are compared with the last successfully saved tree; loading a stored tree resets the baseline. A failed save never clears dirty state, and a save completing after newer edits leaves the editor dirty.

The host owns authentication and injects its API-backed `PageStore` and optional `uploadMedia(file)` function. The editor does not read host tokens. The upload callback returns the persisted media URL; without it, standalone Pages stores a bounded image data URL locally. The callback is used by the accessible picker and image paste/drop field.

### Read-only renderer

Public routes should import `renderer.js` and `renderer.css`, not `editor.js`. The renderer entry owns its bundled React root and does not require the host's React instance:

```ts
import { mountRenderer } from './renderer.js';

const handle = mountRenderer({
  container,
  document,
  theme,
  assetBasePath: '/media/',
  asLandmark: false,
});
handle.unmount();
```

`PageDocumentRenderer` is also exported as a component from `editor.js` for use inside the editor's bundled React tree. The standalone public entry is `mountRenderer(container, document, theme, options)`, equivalent to the options-object signature above. It renders validated canonical builder JSON only; Tiptap JSON is not rewritten or passed through this entry.

### Worker-safe schema

Workers import only `schema.js` (and its manifest-listed relative chunks), not either React bundle:

```ts
import { PAGE_SCHEMA_VERSION, validatePageDocument } from './schema.js';
const result = validatePageDocument(requestBody.document);
if (!result.ok) return Response.json({ errors: result.errors }, { status: 400 });
```

The validator has no React, React DOM, browser storage, or DOM dependency. It validates the canonical document shape, registered block payloads, unique IDs, nested depth, rich text marks/nodes, media URLs, embed provider IDs, and image alt text. Revision metadata is not accepted in the JSON document.

## Standalone Pages routes and persistence

- `/` opens the `default` page; `/editor` lists, creates, and deletes local pages; `/editor/:pageId` edits one local page.
- `apps/web/src/editor/routes.ts` keeps GitHub Pages subpath routing. The Pages build continues to use `LocalStore`.
- The `default` page remains at `react-aria-page-builder.page`; other IDs remain at `react-aria-page-builder.page:<id>`.
- `parsePage` continues accepting the prior flat page definition format and current versioned JSON. No existing local key or page ID is migrated or removed.
- The standalone app keeps its normal Vite build and deep-link `404.html` fallback; the embedding build is separate and does not generate or replace a host `index.html`.

## Tiptap replacement parity inventory

The active-extension/node parity matrix, inactive-feature disposition, legacy-style constraints, and remaining deployment-owned compatibility gaps are documented in [editor-parity-matrix.md](./editor-parity-matrix.md).

## Compatibility release record

| Editor source revision | Artifact version | JSON schema version | Host compatibility |
|---|---:|---:|---|
| Recorded in `dist-embed/manifest.json` | 1 | 1 | Host records and verifies its pin after compatibility tests |

The generated manifest, rather than a hand-maintained guessed commit, is authoritative for each artifact build.
