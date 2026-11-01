import {
  DEFAULT_STORAGE_KEY,
  createDocument,
  parsePage,
  serializeDocument,
  type PageDocument,
} from '@page-builder/ui';
import {
  DEFAULT_PAGE_ID,
  PageStoreError,
  isValidPageId,
  type PageStore,
  type PageStoreIdentity,
  type PageStoreSaveOptions,
  type PageSummary,
} from './types';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export interface LocalStoreOptions {
  storage?: StorageLike;
  /** Key prefix; the `default` page lives at the bare prefix. */
  keyPrefix?: string;
}

const assertValidId = (id: string) => {
  if (!isValidPageId(id)) {
    throw new PageStoreError([
      `"${id}" is not a valid page id. Use letters, numbers, hyphens and underscores (up to 64 characters).`,
    ]);
  }
};

const localPageId = (identity: PageStoreIdentity): string => {
  if (typeof identity === 'string') return identity;
  if (identity.kind !== 'page' || typeof identity.id !== 'string') {
    throw new PageStoreError(['LocalStore supports string page IDs only.'], 'unsupported-identity');
  }
  return identity.id;
};

/**
 * Keeps pages in localStorage. The `default` page uses the same key as earlier
 * versions of the builder, so previously saved pages (including the legacy flat
 * format, which `parsePage` migrates) keep loading.
 */
export class LocalStore implements PageStore {
  private readonly storage: StorageLike;
  private readonly prefix: string;

  constructor({ storage, keyPrefix = DEFAULT_STORAGE_KEY }: LocalStoreOptions = {}) {
    this.storage = storage ?? localStorage;
    this.prefix = keyPrefix;
  }

  private keyFor(identity: PageStoreIdentity) {
    const id = localPageId(identity);
    assertValidId(id);
    return id === DEFAULT_PAGE_ID ? this.prefix : `${this.prefix}:${id}`;
  }

  async load(identity: PageStoreIdentity) {
    const key = this.keyFor(identity);
    let text: string | null;
    try {
      text = this.storage.getItem(key);
    } catch {
      throw new PageStoreError(['The browser blocked access to saved pages.']);
    }
    if (text === null) return null;
    const result = parsePage(text);
    if (!result.ok) throw new PageStoreError(result.errors);
    return {
      document: createDocument(result.tree, savedAtOf(text)),
      revision: null,
      publishedRevision: null,
    };
  }

  async save(identity: PageStoreIdentity, doc: PageDocument, _options?: PageStoreSaveOptions) {
    const key = this.keyFor(identity);
    const result = serializeDocument(doc);
    if (!result.ok) throw new PageStoreError(result.errors);
    try {
      this.storage.setItem(key, result.json);
    } catch {
      throw new PageStoreError([
        'The browser refused to store the page (storage full or blocked).',
      ]);
    }
    return { revision: null, publishedRevision: null };
  }

  async list(): Promise<PageSummary[]> {
    const pages: PageSummary[] = [];
    for (let index = 0; index < this.storage.length; index++) {
      const key = this.storage.key(index);
      if (key === null) continue;
      let id: string | null = null;
      if (key === this.prefix) id = DEFAULT_PAGE_ID;
      else if (key.startsWith(`${this.prefix}:`)) id = key.slice(this.prefix.length + 1);
      if (id === null || !isValidPageId(id)) continue;
      const text = this.storage.getItem(key);
      const savedAt = text === null ? undefined : savedAtOf(text)?.toISOString();
      pages.push(savedAt ? { id, kind: 'page', savedAt } : { id, kind: 'page' });
    }
    return pages.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  async remove(identity: PageStoreIdentity): Promise<void> {
    this.storage.removeItem(this.keyFor(identity));
  }
}

const savedAtOf = (text: string): Date | undefined => {
  try {
    const value = (JSON.parse(text) as { savedAt?: unknown }).savedAt;
    const date = typeof value === 'string' ? new Date(value) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
};
