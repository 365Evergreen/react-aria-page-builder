import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, TextField } from '@page-builder/ui';
import { editorHref } from './routes';
import {
  PageStoreError,
  isValidPageId,
  type PageStore,
  type PageSummary,
} from './store/types';

interface EditorIndexProps {
  store: PageStore;
  basePath: string;
}

export function EditorIndex({ store, basePath }: EditorIndexProps) {
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newId, setNewId] = useState('');
  const [showError, setShowError] = useState(false);

  const refresh = useCallback(() => {
    store
      .list()
      .then(setPages)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Cannot list pages.'),
      );
  }, [store]);

  useEffect(refresh, [refresh]);

  const idError = isValidPageId(newId)
    ? null
    : 'Use letters, numbers, hyphens and underscores (up to 64 characters).';

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (idError) return setShowError(true);
    window.location.assign(editorHref(basePath, newId));
  };

  const remove = async (id: string) => {
    try {
      await store.remove(id);
      refresh();
    } catch (cause) {
      setError(cause instanceof PageStoreError ? cause.message : 'Cannot delete the page.');
    }
  };

  return (
    <main className="editor-index">
      <h1>Pages</h1>
      {error && <p role="alert">{error}</p>}

      <section aria-labelledby="editor-pages-heading">
        <h2 id="editor-pages-heading">Saved pages</h2>
        {pages === null ? (
          <p role="status">Loading pages…</p>
        ) : pages.length === 0 ? (
          <p>No saved pages yet. Create one below.</p>
        ) : (
          <ul className="editor-page-list">
            {pages.map((page) => (
              <li key={page.id}>
                <a href={editorHref(basePath, page.id)}>{page.id}</a>
                {page.savedAt && (
                  <span className="editor-muted">
                    {' '}
                    saved <time dateTime={page.savedAt}>{new Date(page.savedAt).toLocaleString('en-GB')}</time>
                  </span>
                )}{' '}
                <Button variant="quiet" onPress={() => void remove(page.id)}>
                  Delete {page.id}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="editor-new-heading">
        <h2 id="editor-new-heading">New page</h2>
        <form onSubmit={create} noValidate>
          <TextField
            label="Page id"
            description="Used in the address, for example /editor/about."
            value={newId}
            onChange={setNewId}
            isInvalid={showError && idError !== null}
            errorMessage={idError ?? undefined}
            validationBehavior="aria"
          />
          <Button type="submit">Create page</Button>
        </form>
      </section>
    </main>
  );
}
