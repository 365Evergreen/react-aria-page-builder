import type { PageDocument } from './editor.js';

export declare const PAGE_SCHEMA_VERSION: number;
export declare function validatePageDocument(input: unknown):
  | { ok: true; document: PageDocument }
  | { ok: false; errors: string[] };
export declare const richTextSchema: unknown;
export declare function validateRichText(input: unknown): string[];
