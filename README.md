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
