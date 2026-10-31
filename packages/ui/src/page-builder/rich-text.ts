import { z } from 'zod';
import { SAFE_LINK } from './safe-url';

/**
 * Structured rich text: plain JSON, no Markdown and no HTML.
 * Inline formatting is expressed as marks on text runs.
 */

export const MAX_RUN_TEXT = 2000;
export const MAX_RICH_BLOCKS = 200;
export const MAX_RUNS = 100;
export const MAX_LIST_ITEMS = 100;

export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'code' }
  | { type: 'link'; href: string };

export type MarkType = Mark['type'];

export interface TextRun {
  text: string;
  marks?: Mark[];
}

export interface ListItem {
  id: string;
  children: TextRun[];
}

export type HeadingLevel = 2 | 3 | 4;

export type RichTextBlock =
  | { id: string; type: 'paragraph'; children: TextRun[] }
  | { id: string; type: 'heading'; level: HeadingLevel; children: TextRun[] }
  | { id: string; type: 'list'; ordered: boolean; items: ListItem[] };

export type RichTextDoc = RichTextBlock[];

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }).strict(),
  z.object({ type: z.literal('italic') }).strict(),
  z.object({ type: z.literal('code') }).strict(),
  z
    .object({
      type: z.literal('link'),
      href: z
        .string()
        .max(2000)
        .refine((value) => SAFE_LINK.test(value.trim()), {
          message: 'Link must be http(s), mailto, tel, or a relative/hash link',
        }),
    })
    .strict(),
]);

const runSchema = z
  .object({
    text: z.string().max(MAX_RUN_TEXT),
    marks: z.array(markSchema).max(4).optional(),
  })
  .strict();

const runsSchema = z.array(runSchema).max(MAX_RUNS);

export const richTextSchema = z
  .array(
    z.discriminatedUnion('type', [
      z
        .object({
          id: z.string().min(1),
          type: z.literal('paragraph'),
          children: runsSchema,
        })
        .strict(),
      z
        .object({
          id: z.string().min(1),
          type: z.literal('heading'),
          level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
          children: runsSchema,
        })
        .strict(),
      z
        .object({
          id: z.string().min(1),
          type: z.literal('list'),
          ordered: z.boolean(),
          items: z
            .array(z.object({ id: z.string().min(1), children: runsSchema }).strict())
            .max(MAX_LIST_ITEMS),
        })
        .strict(),
    ]),
  )
  .max(MAX_RICH_BLOCKS);

const newId = () => crypto.randomUUID();

export const createRun = (text = '', marks?: Mark[]): TextRun =>
  marks && marks.length > 0 ? { text, marks } : { text };

export const createParagraph = (text = ''): RichTextBlock => ({
  id: newId(),
  type: 'paragraph',
  children: [createRun(text)],
});

export const createHeading = (text = '', level: HeadingLevel = 2): RichTextBlock => ({
  id: newId(),
  type: 'heading',
  level,
  children: [createRun(text)],
});

export const createList = (items: string[] = [''], ordered = false): RichTextBlock => ({
  id: newId(),
  type: 'list',
  ordered,
  items: items.map((text) => ({ id: newId(), children: [createRun(text)] })),
});

export const hasMark = (run: TextRun, type: MarkType) =>
  run.marks?.some((mark) => mark.type === type) ?? false;

export const getLinkHref = (run: TextRun) => {
  const link = run.marks?.find((mark) => mark.type === 'link');
  return link && link.type === 'link' ? link.href : '';
};

/** Adds or removes a simple (non-link) mark on a run, keeping marks tidy. */
export const toggleMark = (
  run: TextRun,
  type: Exclude<MarkType, 'link'>,
  on: boolean,
): TextRun => {
  const others = (run.marks ?? []).filter((mark) => mark.type !== type);
  return createRun(run.text, on ? [...others, { type }] : others);
};

/** Sets the link on a run; an empty href removes it. */
export const setLink = (run: TextRun, href: string): TextRun => {
  const others = (run.marks ?? []).filter((mark) => mark.type !== 'link');
  return createRun(run.text, href.trim() === '' ? others : [...others, { type: 'link', href }]);
};

export const runsToPlainText = (runs: TextRun[]) => runs.map((run) => run.text).join('');

export const richTextToPlainText = (doc: RichTextDoc): string =>
  doc
    .map((block) =>
      block.type === 'list'
        ? block.items.map((item) => runsToPlainText(item.children)).join('\n')
        : runsToPlainText(block.children),
    )
    .filter((text) => text !== '')
    .join('\n\n');

/** Returns human-readable problems; an empty array means the document is valid. */
export const validateRichText = (doc: unknown): string[] => {
  const result = richTextSchema.safeParse(doc);
  if (result.success) {
    const ids = new Set<string>();
    const errors: string[] = [];
    const check = (id: string) => {
      if (ids.has(id)) errors.push(`Duplicate id "${id}" in rich text.`);
      ids.add(id);
    };
    result.data.forEach((block) => {
      check(block.id);
      if (block.type === 'list') block.items.forEach((item) => check(item.id));
    });
    return errors;
  }
  return result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `Rich text ${path}: ${issue.message}` : `Rich text: ${issue.message}`;
  });
};
