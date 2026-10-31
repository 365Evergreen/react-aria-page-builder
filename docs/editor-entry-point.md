# Editor entry point

The page editor lives in this repo (`apps/web/src/editor/`) and can run standalone or be embedded in another page.

## Phase 1 (delivered)

- **Routes**: `/editor` (list, create and delete pages) and `/editor/:pageId` (edit one page). `/` still opens the editor on the `default` page. Page ids match `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`; anything else shows "Page not found".
- **`mountEditor`**: mounts the editor into any element.
- **`PageStore`**: storage interface with a `LocalStore` (browser `localStorage`) default.
- **Rich text**: structured JSON rich-text block and a post-body block, edited and rendered with React Aria components. No Markdown or HTML.
- **Tests**: vitest (store, routes, rich-text model) and Playwright e2e with axe on the new routes.

## Phases 2-4 (upcoming)

- Phase 2: upcoming.
- Phase 3: `CloudflareStore` (remote `PageStore`). Selecting it today fails with a clear message.
- Phase 4: upcoming.

## `mountEditor`

```ts
import { mountEditor } from './editor';

// Standalone: edit a page
const handle = mountEditor({
  container: document.getElementById('root')!,
  pageId: 'about',
  basePath: '/',
});

// Omit pageId to show the page list
mountEditor({ container, basePath: '/' });

handle.unmount();
```

Options: `container` (required), `pageId`, `storage` (a `PageStore`, default from `VITE_PAGE_STORE`), `basePath` (default from Vite's `BASE_URL`), `theme`.

### Custom store

```ts
import { mountEditor, type PageStore } from './editor';

const store: PageStore = {
  load: async (id) => /* PageDocument | null */ null,
  save: async (id, doc) => {},
  list: async () => [],
  remove: async (id) => {},
};

mountEditor({ container, pageId: 'about', storage: store });
```

## Configuration

| Variable | Values | Purpose |
| --- | --- | --- |
| `VITE_BASE_PATH` | path, default `/` | Public base path (Vite `base`); used for routes and links. |
| `VITE_PAGE_STORE` | `local` (default), `cloudflare` | Selects the store. `cloudflare` is not available until phase 3. |
| `VITE_API_BASE` | URL | Worker API base for the Cloudflare store (phase 3). |

See `apps/web/.env.example`.

## GitHub Pages

`.github/workflows/deploy-pages.yml` builds with `VITE_BASE_PATH=/react-aria-page-builder/`, so the editor is at `/react-aria-page-builder/editor`. The build copies `index.html` to `404.html` so deep links such as `/editor/about` load the app. The Pages preview uses `LocalStore`, so pages are per browser.

## Document format

Pages are versioned JSON (`format` + `version: 1`, `savedAt`, `tree`). `LocalStore` stores the `default` page under the legacy key `react-aria-page-builder.page` and other pages under `react-aria-page-builder.page:<id>`. Legacy flat documents are migrated on load.

## Rich text and post body

A `rich-text` block holds `content`: blocks that are `paragraph`, `heading` (levels 2-4) or `list` (ordered or not). Text is a list of runs `{ text, marks? }` with marks `bold`, `italic`, `code` and `link` (`href` must be http(s), mailto, tel, an anchor or a relative path). A `post-body` block adds `title`, optional `author` and `publishedOn` (`YYYY-MM-DD`) around the same content. Models: `packages/ui/src/page-builder/rich-text.ts` and `post-body.ts`.
