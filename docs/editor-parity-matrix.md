# Editor parity matrix

Source inventory was grounded in the deployment repository at `src/editor/` (baseline `404cd240`), principally `BlockEditor.tsx`, `TiptapEditor.tsx`, `extensions.ts`, the custom nodes, and `BlockToolbar.tsx`. The deployment source had duplicate `Callout`, `Video`, and `Iframe` registrations between its public content extension list and editor list; experimental duplicate column/callout files and commented global modifiers/code-block config are not copied as separate features.

| Active Tiptap behavior / configured attributes | JSON replacement and accessible editing | New public rendering | Legacy Tiptap content |
|---|---|---|---|
| Paragraph, heading levels 1–3, text alignment | Paragraph/heading blocks; level and alignment controls | Semantic `p`/`h1`–`h4` with alignment | Host must render existing JSON unchanged |
| Ordered/bullet lists, ordered-list `start`, list items | Ordered/list blocks, per-item controls, nested items, start-number field | Semantic `ol`/`ul` and `li` | Host compatibility renderer required |
| Bold, italic, underline, strike, inline code, links | Validated marks, safe link field, text-run controls | `strong`, `em`, `u`, `s`, `code`, safe links | Host compatibility renderer required |
| Link autolink and link-on-paste | URL runs are linked on blur after typing or pasting; users can edit/remove the link field | Standard anchor links | Host compatibility renderer required |
| Hard break | Explicit accessible line-break toggle on each text run | `br` | Host compatibility renderer required |
| Blockquote, horizontal rule | Quote and divider insertion; quote content has nested controls | `blockquote`, `hr` | Host compatibility renderer required |
| Code block with language and lowlight highlighting | Language and code fields; highlighting for JavaScript, TypeScript, JSON, CSS, XML/HTML, Bash, Python, and SQL | Highlighted code for supported languages; unknown language stays escaped plain text with its language class | Host compatibility renderer required |
| Callout `variant: info | warning | success` | Variant select and nested rich-text editing | Accessible aside with variant styling | Host compatibility renderer required |
| Two-/three-column layout and column width | Add/remove columns; constrained width percentage and nested editing | Responsive flex columns | Host compatibility renderer required |
| Accordion header text and content | Editable summary and nested content | Native keyboard-operable `details`/`summary` | Host compatibility renderer required |
| Image `src`, `alt`, `title`, resize width/height; image upload, paste, drop | Required alt text, dimensions, alignment, URL, host upload callback or bounded local data URL | Lazy image with bounded presentation attributes | Legacy `containerStyle`/`wrapperStyle` must map only whitelisted dimensions/alignment; arbitrary CSS is deliberately not accepted |
| Audio `src`; controls forced on | Source/title controls | Native `audio controls` | Host compatibility renderer required |
| Video `src`; controls forced on | Source, title, poster, width and height | Native `video controls` | Host compatibility renderer required |
| YouTube `videoId` | Provider ID/title/dimensions controls; 11-character ID validation | `youtube-nocookie.com` iframe with title and explicit permissions | Host compatibility renderer required |
| Vimeo source and 640×360 defaults/options | `vimeo.com` video URL, title, dimensions | `player.vimeo.com` iframe with title and explicit permissions | Host compatibility renderer required |
| Iframe `src`, width `100%`, height `400` | HTTPS URL, accessible title, bounded width/height fields | Lazy iframe with sandbox and strict-origin referrer policy | Host compatibility renderer required |
| Placeholder text | Labels/help text and empty-state controls; no content is inserted as placeholder text | Not rendered | N/A |
| Undo/redo, focus/selection, toolbar insertion, block reordering/duplicate/delete | Existing keyboard-accessible builder canvas plus undo/redo; rich text block controls use React Aria | No editor controls in public output | N/A |
| Search/replace package installed but not imported/configured | Inactive; not carried into the replacement | N/A | N/A |

The editor-side tests cover the JSON schema, list conversion preservation, and renderer output. Deployment-side legacy rendering, API and media authorization, published-vs-draft behavior, and final removal of Tiptap dependencies remain gated on the deployment repository's compatibility fixtures and end-to-end rollout checks. Existing Tiptap documents are not imported, backfilled, or mutated by this editor repository.

## Release verification and remaining gaps

Before the user stopped app testing, workspace typechecking, the six web storage tests, the 46 UI tests, the standalone Pages build, and staged declaration consumer typechecking passed. A native-browser smoke check imported and mounted the built editor and renderer without a host `process` shim. The embedding build traverses renderer imports and rejects the editor-control strings implicated in the reported public-bundle leak.

Full keyboard and axe coverage of the new rich-text, layout, and media controls was not completed. The renderer axe smoke found a test-host landmark issue; the harness correction was not rechecked before testing stopped. No further app tests are run for this release at the user's direction. These results do not establish complete accessibility or deployment acceptance.

Relative media URLs currently require an absolute `assetBasePath`; root-relative bases with relative media URLs are not supported. Canonical validation checks rich-text structure, but the additional rich-text depth and duplicate-ID semantic checks are not yet wired into that entry. Autosave can save the initial loaded tree without an edit. These limitations remain follow-up work rather than verified parity.

The artifact is reproducibly built locally with declarations and checksums; automated versioned artifact publication is not included. Deployment compatibility mapping of legacy image styles, legacy Tiptap rendering, dependency retirement, and feature-flag rollout remain host-owned.
