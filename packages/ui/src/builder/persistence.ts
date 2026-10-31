import { z } from 'zod';
import { pageDefinitionSchema, pageLayoutSchema } from '../page-builder/page-schema';
import { blocksToTree } from './blocks';
import { CONTAINER_TYPE, canHaveChildren, getDefinition } from './definitions';
import type { PageNode, PageTree } from './model';

export const PAGE_FORMAT = 'react-aria-page-builder';
export const PAGE_VERSION = 1;
export const DEFAULT_STORAGE_KEY = 'react-aria-page-builder.page';
const MAX_DEPTH = 16;

const blockSchema = pageLayoutSchema.element;

const propsSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  styles: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const rawNodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: propsSchema,
    children: z.array(rawNodeSchema),
  }),
) as z.ZodType<PageNode>;

const documentSchema = z.object({
  format: z.literal(PAGE_FORMAT),
  version: z.number().int(),
  savedAt: z.string().optional(),
  tree: z.array(rawNodeSchema),
});

export type ParseResult =
  | { ok: true; tree: PageTree }
  | { ok: false; errors: string[] };

const describeIssues = (error: z.ZodError, prefix = '') =>
  error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${prefix}${path ? `${path}: ` : ''}${issue.message}`;
  });

/** Checks semantic rules the structural schema cannot express. */
export const validateTree = (tree: PageTree): string[] => {
  const errors: string[] = [];
  const seen = new Set<string>();

  const visit = (node: PageNode, depth: number, label: string) => {
    if (seen.has(node.id)) errors.push(`${label}: duplicate id "${node.id}".`);
    seen.add(node.id);
    if (depth > MAX_DEPTH) {
      errors.push(`${label}: nested deeper than ${MAX_DEPTH} levels.`);
      return;
    }
    const definition = getDefinition(node.type);
    if (!definition) {
      errors.push(`${label}: unknown block type "${node.type}".`);
    } else if (node.type === CONTAINER_TYPE) {
      const text = node.props.data?.label;
      if (text !== undefined && (typeof text !== 'string' || text.length > 80)) {
        errors.push(`${label}: label must be text of 80 characters or fewer.`);
      }
    } else {
      const result = blockSchema.safeParse({
        id: node.id,
        type: node.type,
        styles: node.props.styles,
        data: node.props.data,
      });
      if (!result.success) errors.push(...describeIssues(result.error, `${label}: `));
    }
    if (node.children.length > 0 && !canHaveChildren(node.type)) {
      errors.push(`${label}: ${node.type} cannot contain other blocks.`);
    }
    node.children.forEach((child, index) =>
      visit(child, depth + 1, `${label} > block ${index + 1}`),
    );
  };

  tree.forEach((node, index) => visit(node, 0, `Block ${index + 1}`));
  return errors;
};

export const serializePage = (tree: PageTree, now = new Date()) => {
  const errors = validateTree(tree);
  if (errors.length > 0) return { ok: false as const, errors };
  return {
    ok: true as const,
    json: JSON.stringify(
      { format: PAGE_FORMAT, version: PAGE_VERSION, savedAt: now.toISOString(), tree },
      null,
      2,
    ),
  };
};

/**
 * Parses untrusted JSON. Accepts the current format and the legacy flat
 * `pageDefinitionSchema` (schemaVersion 1) used by the example page.
 */
export const parsePage = (text: string): ParseResult => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }

  const legacy = pageDefinitionSchema.safeParse(raw);
  if (legacy.success) return finish(blocksToTree(legacy.data.blocks));

  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: ['This is not a page builder file.', ...describeIssues(parsed.error)] };
  }
  if (parsed.data.version > PAGE_VERSION) {
    return {
      ok: false,
      errors: [
        `This file uses format version ${parsed.data.version}; this editor supports up to ${PAGE_VERSION}.`,
      ],
    };
  }
  return finish(parsed.data.tree);
};

const finish = (tree: PageTree): ParseResult => {
  const errors = validateTree(tree);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, tree };
};

export const savePage = (
  tree: PageTree,
  key = DEFAULT_STORAGE_KEY,
  storage: Pick<Storage, 'setItem'> = localStorage,
): { ok: true } | { ok: false; errors: string[] } => {
  const result = serializePage(tree);
  if (!result.ok) return result;
  try {
    storage.setItem(key, result.json);
  } catch {
    return { ok: false, errors: ['The browser refused to store the page (storage full or blocked).'] };
  }
  return { ok: true };
};

export const loadPage = (
  key = DEFAULT_STORAGE_KEY,
  storage: Pick<Storage, 'getItem'> = localStorage,
): ParseResult | null => {
  let text: string | null;
  try {
    text = storage.getItem(key);
  } catch {
    return null;
  }
  return text === null ? null : parsePage(text);
};
