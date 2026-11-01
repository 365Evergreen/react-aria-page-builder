import { useEffect, useMemo, useState } from 'react';
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
import { editorHref } from './routes';
import { DEFAULT_PAGE_ID, PageStoreError, type PageStore } from './store/types';

const example = pageDefinitionSchema.parse(examplePage);

export const defaultTheme: ThemeColors = example.theme;

/** The default page starts from the example page; other new pages start with a hero. */
const starterTree = (pageId: string): PageTree =>
  pageId === DEFAULT_PAGE_ID ? blocksToTree(example.blocks) : [createNode('hero-banner')];

const errorsOf = (error: unknown) =>
  error instanceof PageStoreError
    ? error.errors
    : [error instanceof Error ? error.message : 'Unexpected error.'];

export interface EditorProps {
  pageId: string;
  store: PageStore;
  basePath: string;
  theme?: ThemeColors;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; tree: PageTree; isNew: boolean }
  | { status: 'error'; errors: string[] };

export function Editor({ pageId, store, basePath, theme = defaultTheme }: EditorProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    store
      .load(pageId)
      .then((doc) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          tree: doc ? doc.tree : starterTree(pageId),
          isNew: doc === null,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', errors: errorsOf(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [store, pageId]);

  const persistence = useMemo<PageBuilderPersistence>(
    () => ({
      save: async (tree) => {
        try {
          await store.save(pageId, createDocument(tree));
          return { ok: true };
        } catch (error) {
          return { ok: false, errors: errorsOf(error) };
        }
      },
      load: async () => {
        try {
          const doc = await store.load(pageId);
          return doc ? { ok: true, tree: doc.tree } : null;
        } catch (error) {
          return { ok: false, errors: errorsOf(error) };
        }
      },
    }),
    [store, pageId],
  );

  if (state.status === 'loading') {
    return (
      <main className="editor-status" role="status">
        Loading page “{pageId}”…
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="editor-status" role="alert">
        <h1>Cannot open page “{pageId}”</h1>
        {state.errors.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        <p>
          <a href={editorHref(basePath)}>Back to all pages</a>
        </p>
      </main>
    );
  }

  return (
    <>
      <nav className="editor-nav" aria-label="Editor">
        <a href={editorHref(basePath)}>All pages</a>
        <span>
          Page: <strong>{pageId}</strong>
          {state.isNew ? ' (not saved yet)' : ''}
        </span>
      </nav>
      <PageBuilder
        key={pageId}
        title={`Page builder: ${pageId}`}
        initialTree={state.tree}
        theme={theme}
        persistence={persistence}
        autoSave
      />
    </>
  );
}
