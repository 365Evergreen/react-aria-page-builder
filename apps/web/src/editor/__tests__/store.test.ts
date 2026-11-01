import { describe, expect, it } from 'vitest';
import { createDocument, createNode, serializePage } from '@page-builder/ui';
import { LocalStore } from '../store/local-store';
import { PageStoreError, isValidPageId } from '../store/types';
import { parseRoute } from '../routes';
import { normaliseBasePath } from '../config';

class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const make = () => {
  const storage = new MemoryStorage();
  return { storage, store: new LocalStore({ storage: storage as unknown as Storage }) };
};

describe('LocalStore', () => {
  it('round-trips, lists and removes pages', async () => {
    const { store } = make();
    const doc = createDocument([createNode('rich-text', 'r')]);
    await store.save('about', doc);
    expect((await store.load('about'))?.tree).toEqual(doc.tree);
    expect(await store.load('missing')).toBeNull();
    expect((await store.list()).map((p) => p.id)).toEqual(['about']);
    await store.remove('about');
    expect(await store.list()).toEqual([]);
  });

  it('rejects invalid ids', async () => {
    const { store } = make();
    expect(isValidPageId('../x')).toBe(false);
    await expect(store.save('../x', createDocument([]))).rejects.toBeInstanceOf(PageStoreError);
  });

  it('migrates the legacy flat format', async () => {
    const { store, storage } = make();
    const tree = [createNode('rich-text', 'r')];
    const saved = serializePage(tree);
    if (!saved.ok) throw new Error('serialize failed');
    storage.setItem('react-aria-page-builder.page', saved.json);
    expect((await store.load('default'))?.tree).toEqual(tree);
  });
});

describe('routes and config', () => {
  it('parses routes under a base path', () => {
    expect(parseRoute('/app/editor', '/app/').kind).toBe('editor-index');
    expect(parseRoute('/app/editor/x1', '/app/')).toMatchObject({ kind: 'editor', pageId: 'x1' });
    expect(parseRoute('/editor/x1', '/').kind).toBe('editor');
    expect(parseRoute('/editor/a b', '/').kind).toBe('invalid-id');
    expect(parseRoute('/nope', '/').kind).toBe('not-found');
  });

  it('normalises base paths', () => {
    expect(normaliseBasePath('/x')).toBe('/x/');
    expect(normaliseBasePath('')).toBe('/');
  });
});
