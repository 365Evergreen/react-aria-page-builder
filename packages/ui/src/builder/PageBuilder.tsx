import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Download, FolderOpen, Redo2, Save, Undo2, Upload } from 'lucide-react';
import { Button } from '../primitives/Button/Button';
import { Toolbar } from '../primitives/Toolbar/Toolbar';
import { PageRenderer } from '../page-builder/PageRenderer';
import type { ThemeColors } from '../page-builder/types';
import { BlockCanvas } from './BlockCanvas';
import { BlockPalette } from './BlockPalette';
import { canHaveChildren } from './definitions';
import { treeToBlocks } from './blocks';
import { findNode, getSiblings, type PageTree } from './model';
import {
  DEFAULT_STORAGE_KEY,
  type ParseResult,
  loadPage,
  parsePage,
  savePage,
  serializePage,
} from './persistence';
import { PropsPanel } from './PropsPanel';
import { builderReducer, createInitialState } from './reducer';
import './builder.css';

export interface PageBuilderPersistence {
  save(tree: PageTree): Promise<{ ok: true } | { ok: false; errors: string[] }>;
  load(): Promise<ParseResult | null>;
  /** Where the page is kept, for messages. Defaults to `in this browser`. */
  location?: string;
}

interface PageBuilderProps {
  initialTree?: PageTree;
  theme: ThemeColors;
  storageKey?: string;
  /** Overrides the default localStorage persistence (used by the editor's PageStore). */
  persistence?: PageBuilderPersistence;
  /** Save valid pages shortly after each change. */
  autoSave?: boolean;
  /** Reports whether the current tree differs from the last successful save. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Marks a new document dirty until its first successful save. */
  initialDirty?: boolean;
  /** Heading shown above the builder. */
  title?: string;
  /** Base path used only for relative media URLs in page preview. */
  assetBasePath?: string;
  /** Host upload service for image picker, paste and drag-and-drop. */
  uploadMedia?: (file: File) => Promise<string>;
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error.';

export function PageBuilder({
  initialTree = [],
  theme,
  storageKey = DEFAULT_STORAGE_KEY,
  persistence: customPersistence,
  autoSave = false,
  onDirtyChange,
  initialDirty = false,
  title = 'Page builder',
  assetBasePath,
  uploadMedia,
}: PageBuilderProps) {
  const persistence = useMemo<PageBuilderPersistence>(
    () =>
      customPersistence ?? {
        save: async (next) => savePage(next, storageKey),
        load: async () => loadPage(storageKey),
      },
    [customPersistence, storageKey],
  );
  const location = persistence.location ?? 'in this browser';
  const [state, dispatch] = useReducer(
    builderReducer,
    initialTree,
    createInitialState,
  );
  const [showPreview, setShowPreview] = useState(false);
  const { tree, selectedId } = state;
  const savedTreeRef = useRef<PageTree | null>(initialDirty ? null : initialTree);
  const currentTreeRef = useRef(tree);
  currentTreeRef.current = tree;
  const dirtyRef = useRef(initialDirty);
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  const treeIsDirty = (candidate: PageTree) =>
    savedTreeRef.current === null ||
    JSON.stringify(candidate) !== JSON.stringify(savedTreeRef.current);
  const setDirty = useCallback((dirty: boolean) => {
    if (dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    dirtyCallbackRef.current?.(dirty);
  }, []);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; lines: string[] } | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dirtyCallbackRef.current?.(dirtyRef.current);
  }, [onDirtyChange]);

  useEffect(() => {
    setDirty(treeIsDirty(tree));
  }, [tree, setDirty]);

  const markSaved = (savedTree: PageTree) => {
    savedTreeRef.current = savedTree;
    setDirty(treeIsDirty(currentTreeRef.current));
  };

  useEffect(() => {
    if (!autoSave) return;
    const timer = setTimeout(() => {
      void persistence
        .save(tree)
        .then((result) => {
          if (!result.ok) setNotice({ kind: 'error', lines: ['Cannot save yet:', ...result.errors] });
          else markSaved(tree);
        })
        .catch((error: unknown) =>
          setNotice({ kind: 'error', lines: ['Cannot save yet:', errorText(error)] }),
        );
    }, 400);
    return () => clearTimeout(timer);
  }, [autoSave, tree, persistence]);

  const handleSave = async () => {
    let result;
    try {
      result = await persistence.save(tree);
    } catch (error) {
      result = { ok: false as const, errors: [errorText(error)] };
    }
    setNotice(
      result.ok
        ? { kind: 'info', lines: [`Page saved ${location}.`] }
        : { kind: 'error', lines: ['Cannot save yet:', ...result.errors] },
    );
    if (result.ok) markSaved(tree);
  };

  const handleLoad = async () => {
    let result;
    try {
      result = await persistence.load();
    } catch (error) {
      return setNotice({ kind: 'error', lines: ['Cannot load the page:', errorText(error)] });
    }
    if (!result) return setNotice({ kind: 'error', lines: ['No saved page found.'] });
    if (!result.ok) {
      return setNotice({ kind: 'error', lines: ['The saved page is invalid:', ...result.errors] });
    }
    savedTreeRef.current = result.tree;
    setDirty(false);
    dispatch({ type: 'load', tree: result.tree, message: 'Saved page loaded.' });
    setNotice({ kind: 'info', lines: ['Saved page loaded. Undo restores the previous page.'] });
  };

  const handleExport = () => {
    const result = serializePage(tree);
    if (!result.ok) {
      return setNotice({ kind: 'error', lines: ['Cannot export yet:', ...result.errors] });
    }
    const url = URL.createObjectURL(new Blob([result.json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'page.json';
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'info', lines: ['Exported page.json.'] });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    const result = parsePage(await file.text());
    if (!result.ok) {
      return setNotice({ kind: 'error', lines: [`Cannot import ${file.name}:`, ...result.errors] });
    }
    dispatch({ type: 'load', tree: result.tree, message: `Imported ${file.name}.` });
    setNotice({ kind: 'info', lines: [`Imported ${file.name}. Undo restores the previous page.`] });
  };

  const selected = selectedId ? findNode(tree, selectedId) : null;
  const siblings = selected ? getSiblings(tree, selected.parentId) : [];

  const insertAtSelection = useCallback(
    (blockType: string) => {
      if (selected && canHaveChildren(selected.node.type)) {
        dispatch({
          type: 'add',
          blockType,
          parentId: selected.node.id,
          index: selected.node.children.length,
        });
      } else if (selected) {
        dispatch({
          type: 'add',
          blockType,
          parentId: selected.parentId,
          index: selected.index + 1,
        });
      } else {
        dispatch({ type: 'add', blockType, parentId: null, index: tree.length });
      }
    },
    [selected, tree.length],
  );

  const blocks = useMemo(() => treeToBlocks(tree), [tree]);
  const id = selectedId ?? '';

  return (
    <div className="pb-shell">
      <header className="pb-header">
        <h1 className="pb-title">{title}</h1>
      </header>
      <div className="pb-live pb-visually-hidden" role="status" aria-live="polite">
        {state.announcement}
      </div>

      <aside className="pb-sidebar" aria-label="Block library">
        <BlockPalette onInsert={insertAtSelection} />
      </aside>

      <main className="pb-main" aria-labelledby="pb-canvas-title">
        <h2 id="pb-canvas-title">Canvas</h2>
        <Toolbar aria-label="Block actions" className="pb-toolbar">
          <Button
            variant="secondary"
            isDisabled={state.past.length === 0}
            onPress={() => dispatch({ type: 'undo' })}
          >
            <Undo2 size={16} aria-hidden="true" /> Undo
          </Button>
          <Button
            variant="secondary"
            isDisabled={state.future.length === 0}
            onPress={() => dispatch({ type: 'redo' })}
          >
            <Redo2 size={16} aria-hidden="true" /> Redo
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected || selected.index === 0}
            onPress={() => dispatch({ type: 'moveBy', id, delta: -1 })}
          >
            Move up
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected || selected.index >= siblings.length - 1}
            onPress={() => dispatch({ type: 'moveBy', id, delta: 1 })}
          >
            Move down
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected}
            onPress={() => dispatch({ type: 'duplicate', id })}
          >
            Duplicate
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected}
            onPress={() => dispatch({ type: 'remove', id })}
          >
            Delete
          </Button>
          <Button variant="quiet" onPress={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
        </Toolbar>
        <Toolbar aria-label="Page file" className="pb-toolbar">
          <Button variant="secondary" onPress={() => void handleSave()}>
            <Save size={16} aria-hidden="true" /> Save
          </Button>
          <Button variant="secondary" onPress={() => void handleLoad()}>
            <FolderOpen size={16} aria-hidden="true" /> Load
          </Button>
          <Button variant="secondary" onPress={handleExport}>
            <Download size={16} aria-hidden="true" /> Export JSON
          </Button>
          <Button variant="secondary" onPress={() => fileInput.current?.click()}>
            <Upload size={16} aria-hidden="true" /> Import JSON
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            aria-label="Import page JSON file"
            onChange={(event) => {
              void handleImport(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </Toolbar>
        {notice && (
          <div
            className={`pb-notice pb-notice-${notice.kind}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            {notice.lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        )}
        <p id="pb-canvas-help" className="pb-help">
          Arrow keys move between blocks, Home and End jump to the first and last.
          Alt+Up/Down moves the selected block, Ctrl+D duplicates, Delete removes,
          Ctrl+Z undoes. To drag with the keyboard, focus a block's drag handle and
          press Enter.
        </p>
        <BlockCanvas
          tree={tree}
          selectedId={selectedId}
          focusId={state.focusId}
          theme={theme}
          dispatch={dispatch}
        />
        {showPreview && (
          <section className="pb-preview" aria-label="Page preview">
            <PageRenderer
              blocks={blocks}
              theme={theme}
              isEditing
              asLandmark={false}
              assetBasePath={assetBasePath}
            />
          </section>
        )}
      </main>

      <aside className="pb-sidebar" aria-label="Block inspector">
        <PropsPanel tree={tree} selectedId={selectedId} dispatch={dispatch} uploadMedia={uploadMedia} />
      </aside>
    </div>
  );
}
