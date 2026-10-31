import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ThemeColors } from '@page-builder/ui';
import { createStore, readConfig } from './config';
import { Editor } from './Editor';
import { EditorIndex } from './EditorIndex';
import type { PageStore } from './store/types';

export interface MountEditorOptions {
  /** Element to render into. */
  container: HTMLElement;
  /** Page to edit. Omit to show the list of pages. */
  pageId?: string;
  /** Where pages are kept. Defaults to the store selected by `VITE_PAGE_STORE`. */
  storage?: PageStore;
  /** App base path, used for links. Defaults to Vite's `BASE_URL`. */
  basePath?: string;
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
  storage,
  basePath,
  theme,
}: MountEditorOptions): EditorHandle {
  const root = createRoot(container);
  try {
    const config = readConfig();
    const store = storage ?? createStore(config);
    const base = basePath ?? config.basePath;
    root.render(
      <StrictMode>
        {pageId === undefined ? (
          <EditorIndex store={store} basePath={base} />
        ) : (
          <Editor pageId={pageId} store={store} basePath={base} theme={theme} />
        )}
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
