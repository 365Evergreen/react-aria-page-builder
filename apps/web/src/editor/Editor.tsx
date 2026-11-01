import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  PageBuilder,
  blocksToTree,
  createDocument,
  createNode,
  pageDefinitionSchema,
  type PageBuilderPersistence,
  type PageTree,
  type ThemeColors,
} from '@page-builder/ui';
import examplePage from '../example-page.json';
import { editorHref, hostedEditorHref } from './routes';
import {
  DEFAULT_PAGE_ID,
  PageStoreError,
  type DocumentIdentity,
  type PageStore,
} from './store/types';

const example = pageDefinitionSchema.parse(examplePage);

export const defaultTheme: ThemeColors = example.theme;

/** The default page starts from the example page; other new pages start with a hero. */
const starterTree = (identity: DocumentIdentity): PageTree =>
  identity.kind === 'page' && identity.id === DEFAULT_PAGE_ID
    ? blocksToTree(example.blocks)
    : identity.kind === 'post'
      ? [createNode('post-body')]
      : [createNode('hero-banner')];

const errorsOf = (error: unknown) =>
  error instanceof PageStoreError
    ? error.errors
    : [error instanceof Error ? error.message : 'Unexpected error.'];

export interface EditorProps {
  pageId?: string;
  identity?: DocumentIdentity;
  store: PageStore;
  basePath: string;
  routeBasePath?: string;
  navigate?: (href: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  assetBasePath?: string;
  uploadMedia?: (file: File) => Promise<string>;
  theme?: ThemeColors;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tree: PageTree; isNew: boolean; revision: string | null }
  | { status: 'error'; errors: string[] };

export function Editor({
  pageId,
  identity: identityProp,
  store,
  basePath,
  routeBasePath,
  navigate,
  onDirtyChange,
  assetBasePath,
  uploadMedia,
  theme = defaultTheme,
}: EditorProps) {
  const identity = useMemo<DocumentIdentity>(
    () => identityProp ?? { kind: 'page', id: pageId ?? DEFAULT_PAGE_ID },
    [identityProp?.kind, identityProp?.id, pageId],
  );
  const routeId = String(identity.id);
  const indexHref = routeBasePath ? hostedEditorHref(routeBasePath) : editorHref(basePath);
  const handleBackClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!navigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(indexHref);
  };
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const revisionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    store.load(identity)
      .then((doc) => {
        if (cancelled) return;
        revisionRef.current = doc?.revision ?? null;
        setState({
          status: 'ready',
          tree: doc ? doc.document.tree : starterTree(identity),
          isNew: doc === null,
          revision: doc?.revision ?? null,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', errors: errorsOf(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [store, identity]);

  const persistence = useMemo<PageBuilderPersistence>(
    () => ({
      save: async (tree) => {
        try {
          const result = await store.save(identity, createDocument(tree), {
            expectedRevision: revisionRef.current,
          });
          revisionRef.current = result.revision;
          setState((current) =>
            current.status === 'ready' ? { ...current, revision: result.revision } : current,
          );
          return { ok: true };
        } catch (error) {
          return { ok: false, errors: errorsOf(error) };
        }
      },
      load: async () => {
        try {
          const doc = await store.load(identity);
          if (!doc) return null;
          revisionRef.current = doc.revision;
          return { ok: true, tree: doc.document.tree };
        } catch (error) {
          return { ok: false, errors: errorsOf(error) };
        }
      },
    }),
    [store, identity],
  );

  if (state.status === 'loading') {
    return (
      <main className="editor-status" role="status">
        Loading {identity.kind} “{routeId}”…
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="editor-status" role="alert">
        <h1>Cannot open {identity.kind} “{routeId}”</h1>
        {state.errors.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        <p>
          <a href={indexHref} onClick={handleBackClick}>Back to all pages</a>
        </p>
      </main>
    );
  }

  return (
    <>
      <nav className="editor-nav" aria-label="Editor">
        <a href={indexHref} onClick={handleBackClick}>All pages</a>
        <span>
          {identity.kind}: <strong>{routeId}</strong>
          {state.isNew ? ' (not saved yet)' : ''}
        </span>
        {state.revision && <span>Revision: {state.revision}</span>}
      </nav>
      <PageBuilder
        key={`${identity.kind}:${routeId}`}
        title={`${identity.kind} builder: ${routeId}`}
        initialTree={state.tree}
        theme={theme}
        persistence={persistence}
        autoSave
        initialDirty={state.isNew}
        onDirtyChange={onDirtyChange}
        assetBasePath={assetBasePath}
        uploadMedia={uploadMedia}
      />
    </>
  );
}
