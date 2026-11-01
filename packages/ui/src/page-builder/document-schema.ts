import { z } from 'zod';
import { pageLayoutSchema } from './page-schema';
import { MAX_RICH_TEXT_DEPTH } from './rich-text';
import type { PageDocument } from '../builder/persistence';

export const PAGE_SCHEMA_VERSION = 1;
const MAX_TREE_NODES = 2000;

const propsSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  styles: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).strict();

interface DocumentNode {
  id: string;
  type: string;
  props: z.infer<typeof propsSchema>;
  children: DocumentNode[];
}

const nodeSchema: z.ZodType<DocumentNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: propsSchema,
    children: z.array(nodeSchema).max(MAX_TREE_NODES),
  }).strict(),
);

const pageDocumentSchema = z.object({
  format: z.literal('react-aria-page-builder'),
  version: z.number().int().min(1).max(PAGE_SCHEMA_VERSION),
  savedAt: z.string().datetime().optional(),
  tree: z.array(nodeSchema).max(MAX_TREE_NODES),
}).strict();

export type PageDocumentValidation =
  | { ok: true; document: PageDocument }
  | { ok: false; errors: string[] };

const issuesOf = (error: z.ZodError) =>
  error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path ? `${path}: ` : ''}${issue.message}`;
  });

/** Validates canonical editor JSON without importing React or browser APIs. */
export const validatePageDocument = (input: unknown): PageDocumentValidation => {
  const parsed = pageDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesOf(parsed.error) };

  const errors: string[] = [];
  const ids = new Set<string>();
  let nodeCount = 0;
  const visit = (node: DocumentNode, depth: number, label: string) => {
    nodeCount += 1;
    if (nodeCount > MAX_TREE_NODES) {
      errors.push(`Document exceeds the maximum of ${MAX_TREE_NODES} blocks.`);
      return;
    }
    if (depth > MAX_RICH_TEXT_DEPTH) {
      errors.push(`${label}: nested deeper than ${MAX_RICH_TEXT_DEPTH} levels.`);
      return;
    }
    if (ids.has(node.id)) errors.push(`${label}: duplicate id "${node.id}".`);
    ids.add(node.id);
    if (node.type === 'container') {
      const labelValue = node.props.data?.label;
      if (labelValue !== undefined && (typeof labelValue !== 'string' || labelValue.length > 80)) {
        errors.push(`${label}: container label must be 80 characters or fewer.`);
      }
    } else {
      const result = pageLayoutSchema.element.safeParse({
        id: node.id,
        type: node.type,
        styles: node.props.styles,
        data: node.props.data,
      });
      if (!result.success) errors.push(...issuesOf(result.error).map((issue) => `${label}: ${issue}`));
      if (node.children.length > 0) errors.push(`${label}: ${node.type} cannot contain child blocks.`);
    }
    node.children.forEach((child, index) => visit(child, depth + 1, `${label} > block ${index + 1}`));
  };
  parsed.data.tree.forEach((node, index) => visit(node, 0, `Block ${index + 1}`));

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, document: parsed.data as PageDocument };
};
