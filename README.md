# React Page Builder Scaffold

A Vite, React and TypeScript workspace for rendering JSON-defined pages through a typed component registry. The shared UI package owns block contracts, registry metadata, runtime validation and theme injection; the web app demonstrates how to render a page definition.

## Included

- npm workspaces with `apps/web` and `packages/ui`
- metadata-rich registry grouped by block category
- typed `hero-banner`, `grid-section` and `media-gallery` blocks
- block factory with cloned defaults and generated IDs
- scoped theme JSON mapped to CSS custom properties
- Zod validation at the persisted-JSON boundary
- edit-mode fallback for unsupported block types
- accessible starter components and responsive styling

## Start

```bash
npm install
npm run dev
```

## Page builder

`apps/web` mounts `PageBuilder` from `packages/ui/src/builder`:

- **Page model** (`model.ts`, `reducer.ts`): a tree of `{ id, type, props, children }` nodes and a pure reducer for add, move, moveBy, remove, duplicate, update, select, undo and redo (100-step history; consecutive edits of one field coalesce). Only `container` blocks accept children. The reducer also produces the aria-live announcement text and the block to focus after each edit.
- **Block palette** (`BlockPalette.tsx`): searchable React Aria `GridList` built from the registry, with a dedicated drag-handle button per row (no nested interactive controls). Enter on a row inserts at the selection (inside a selected container, otherwise after the selected block, otherwise at the end); drag the handle with the pointer, or press Enter on it for keyboard drag.
- **Canvas** (`BlockCanvas.tsx`): React Aria `Tree` with collection drag and drop, drop indicators, a drag handle per row, and live block previews (rendered by `PageRenderer` inside an inert, `aria-hidden` wrapper so tree navigation stays accessible). Arrow keys, Home and End move and select; Left/Right collapse and expand containers.
- **Properties panel** (`PropsPanel.tsx`): schema-driven (`definitions.ts` field definitions): every block prop has a labelled input (text, textarea, number, select, checkbox, URL, repeatable lists). Inputs are validated (required, length, integer range, safe http(s)/relative URLs, alt text required unless an image is marked decorative); only valid values reach the tree.
- **Persistence** (`persistence.ts`): versioned JSON `{ format: 'react-aria-page-builder', version: 1, page }` validated with zod (unknown types, children on non-containers, duplicate ids, depth). The toolbar offers Save/Load (localStorage key `react-aria-page-builder.page`) and Export/Import JSON; the app also autosaves valid pages. Legacy flat page JSON is imported; newer versions are rejected. Save and export refuse invalid pages.

### Keyboard

| Key | Action |
| --- | --- |
| Arrow keys, Home, End | Move between blocks |
| Alt+Up / Alt+Down | Move selected block up or down among siblings |
| Ctrl/Cmd+D | Duplicate |
| Delete / Backspace | Delete |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (or Y) | Undo, redo |
| Enter on a drag handle, then arrows | Keyboard drag and drop (React Aria) |

Changes are announced in a polite live region and focus returns to the affected block. Animations are disabled under `prefers-reduced-motion`.

## Tests

```bash
npm test
```

Vitest and Testing Library cover the reducer, validation, persistence, keyboard interaction and jsdom axe checks.

Real-browser tests (Playwright, Chromium) cover pointer drag from the palette, pointer reorder, keyboard drag on the canvas and from the palette, previews, validation, persistence round trips and axe scans (WCAG 2.x A/AA, including colour contrast, which jsdom cannot check):

```bash
npx playwright install chromium   # once
npm run test:e2e                 # builds, serves on :4173 and runs the suite
```

Keyboard drag: Enter on a drag handle, Arrow keys between insertion points, Enter to drop, Escape to cancel (Tab also cancels).

### Known gaps

- Only Chromium is tested in e2e.
- Palette rows insert with Enter, not Space.
- Previews are clipped to a fixed height and not scaled.
- Only format v1 and the legacy flat format are understood; add migrations when the format changes.

## Other commands

```bash
npm run typecheck
npm run build
npm run preview
```

## Add a block

1. Define its configuration in `packages/ui/src/page-builder/block-configs.ts`.
2. Build the component in `packages/ui/src/components`.
3. Export the component from the component barrel.
4. Add its metadata and defaults to `registry.ts`.
5. Add its runtime schema to `page-schema.ts`.
6. Add the configuration to the `PageBlockConfig` union.

Keep persisted `type` identifiers stable. When a contract changes, add an explicit migration rather than silently changing existing stored page data.
