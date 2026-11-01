import type { PageDocument } from '@page-builder/ui';

export interface PageSummary {
  id: string;
  savedAt?: string;
}

/**
 * Where editor pages are kept. Documents use the versioned JSON format (v1)
 * from `@page-builder/ui`. Implementations must be async so remote stores
 * (such as the planned CloudflareStore) fit the same contract.
 */
export interface PageStore {
  /** Resolves to `null` when the page does not exist. */
  load(id: string): Promise<PageDocument | null>;
  save(id: string, doc: PageDocument): Promise<void>;
  list(): Promise<PageSummary[]>;
  remove(id: string): Promise<void>;
}

/** Thrown for problems the user can act on (invalid document, storage refused). */
export class PageStoreError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join(' '));
    this.name = 'PageStoreError';
    this.errors = errors;
  }
}

export const PAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const isValidPageId = (id: string) => PAGE_ID_PATTERN.test(id);

export const DEFAULT_PAGE_ID = 'default';
