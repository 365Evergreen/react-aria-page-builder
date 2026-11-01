import type { PageDocument } from '@page-builder/ui';

export type DocumentKind = 'page' | 'post';
export type DocumentId = string | number;

/** Database IDs remain typed; standalone pages may continue using string IDs. */
export interface DocumentIdentity {
  kind: DocumentKind;
  id: DocumentId;
}

export type PageStoreIdentity = string | DocumentIdentity;

export interface PageStoreSnapshot {
  document: PageDocument;
  revision: string | null;
  publishedRevision: string | null;
}

export interface PageStoreSaveOptions {
  /** `null` means create-only; omitted is reserved for local/legacy stores. */
  expectedRevision?: string | null;
}

export interface PageStoreSaveResult {
  revision: string | null;
  publishedRevision: string | null;
}

export interface PageSummary {
  id: DocumentId;
  kind?: DocumentKind;
  savedAt?: string;
}

/**
 * Where editor pages are kept. Documents use the versioned JSON format (v1)
 * from `@page-builder/ui`. Implementations must be async so remote stores
 * (such as the planned CloudflareStore) fit the same contract.
 */
export interface PageStore {
  /** Resolves to `null` when the document does not exist. */
  load(identity: PageStoreIdentity): Promise<PageStoreSnapshot | null>;
  save(
    identity: PageStoreIdentity,
    doc: PageDocument,
    options?: PageStoreSaveOptions,
  ): Promise<PageStoreSaveResult>;
  list(): Promise<PageSummary[]>;
  remove(identity: PageStoreIdentity): Promise<void>;
}

/** Thrown for problems the user can act on (invalid document, storage refused). */
export class PageStoreError extends Error {
  readonly errors: string[];
  readonly code: string;

  constructor(errors: string[], code = 'storage-error') {
    super(errors.join(' '));
    this.name = 'PageStoreError';
    this.errors = errors;
    this.code = code;
  }
}

export class PageStoreConflictError extends PageStoreError {
  constructor(message = 'This document changed elsewhere. Reload before saving again.') {
    super([message], 'revision-conflict');
    this.name = 'PageStoreConflictError';
  }
}

export const PAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const isValidPageId = (id: string) => PAGE_ID_PATTERN.test(id);

export const DEFAULT_PAGE_ID = 'default';
