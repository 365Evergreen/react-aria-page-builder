import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ThemeColors } from '@page-builder/ui';
import { createStore, readConfig } from './config';
import { Editor } from './Editor';
import { EditorIndex } from './EditorIndex';
import type { DocumentIdentity, PageStore } from './store/types';

export interface MountEditorOptions {
  /** Element to render into. */
  container: HTMLElement;
  /** Page to edit. Omit to show the list of pages. */
  pageId?: string;
  /** Typed identity for an embedded page or post. */
  identity?: DocumentIdentity;
  /** Where pages are kept. Defaults to the store selected by `VITE_PAGE_STORE`. */
  storage?: PageStore;
  /** Legacy application base path used by standalone Pages routes. */
  basePath?: string;
  /** Host-owned editor index route, for example `/admin/editor/`. */
  routeBasePath?: string;
  /** Base path for relative media assets; independent of route paths. */
  assetBasePath?: string;
  /** Host router navigation callback; links still expose their href for accessibility. */
  navigate?: (href: string) => void;
  /** Reports whether edits are unsaved so the host can protect navigation. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Optional host media upload implementation; LocalStore falls back to image data URLs. */
  uploadMedia?: (file: File) => Promise<string>;
  theme?: ThemeColors;
}

export interface EditorHandle {
  unmount(): void;
}

/**
 * Mounts the editor, standalone or embedded in another page.
 * Returns a handle that unmounts it again.
 */
export function mountEditor({
  container,
  pageId,
  identity,
  storage,
  basePath,
  routeBasePath,
  assetBasePath,
  navigate,
  onDirtyChange,
  uploadMedia,
  theme,
}: MountEditorOptions): EditorHandle {
  const root = createRoot(container);
  try {
    const config = readConfig();
    const store = storage ?? createStore(config);
    const base = basePath ?? config.basePath;
    root.render(
      <StrictMode>
        <div className="pb-embed-root" data-asset-base-path={assetBasePath}>
        {pageId === undefined && identity === undefined ? (
          <EditorIndex
            store={store}
            basePath={routeBasePath ?? base}
            routeBasePath={routeBasePath}
            navigate={navigate}
          />
        ) : (
          <Editor
            pageId={pageId}
            identity={identity}
            store={store}
            basePath={routeBasePath ?? base}
            routeBasePath={routeBasePath}
            navigate={navigate}
            onDirtyChange={onDirtyChange}
            assetBasePath={assetBasePath}
            uploadMedia={uploadMedia}
            theme={theme}
          />
        )}
        </div>
      </StrictMode>,
    );
  } catch (error) {
    root.render(
      <main className="editor-status" role="alert">
        <h1>The editor cannot start</h1>
        <p>{error instanceof Error ? error.message : 'Unexpected error.'}</p>
      </main>,
    );
  }
  return { unmount: () => root.unmount() };
}
