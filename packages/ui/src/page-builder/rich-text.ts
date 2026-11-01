import { z } from 'zod';
import { SAFE_IMAGE, SAFE_LINK } from './safe-url';

/**
 * Structured rich text: plain JSON, no Markdown and no HTML.
 * Inline formatting is expressed as marks on text runs.
 */

export const MAX_RUN_TEXT = 2000;
export const MAX_RICH_BLOCKS = 500;
export const MAX_RUNS = 100;
export const MAX_LIST_ITEMS = 100;
export const MAX_RICH_TEXT_DEPTH = 16;

export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'link'; href: string };

export type MarkType = Mark['type'];

export interface TextRun {
  text: string;
  hardBreak?: boolean;
  marks?: Mark[];
}

export interface ListItem {
  id: string;
  children: TextRun[];
  blocks?: RichTextBlock[];
}

export type HeadingLevel = 1 | 2 | 3 | 4;
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';

export type RichTextBlock =
  | { id: string; type: 'paragraph'; children: TextRun[]; textAlign?: TextAlignment }
  | { id: string; type: 'heading'; level: HeadingLevel; children: TextRun[]; textAlign?: TextAlignment }
  | { id: string; type: 'list'; ordered: boolean; start?: number; items: ListItem[] }
  | { id: string; type: 'blockquote'; children: RichTextBlock[] }
  | { id: string; type: 'code-block'; text: string; language?: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'callout'; variant: 'info' | 'warning' | 'success'; children: RichTextBlock[] }
  | {
      id: string;
      type: 'columns';
      columns: { id: string; width?: number; children: RichTextBlock[] }[];
    }
  | { id: string; type: 'accordion'; title: string; children: RichTextBlock[] }
  | {
      id: string;
      type: 'image';
      src: string;
      alt: string;
      title?: string;
      align?: 'left' | 'center' | 'right';
      width?: number;
      height?: number;
    }
  | { id: string; type: 'audio'; src: string; title?: string }
  | { id: string; type: 'video'; src: string; title?: string; poster?: string; width?: number; height?: number }
  | { id: string; type: 'youtube'; videoId: string; title?: string; width?: number; height?: number }
  | { id: string; type: 'vimeo'; src: string; title?: string; width?: number; height?: number }
  | { id: string; type: 'iframe'; src: string; title?: string; width?: string; height?: string };

export type RichTextDoc = RichTextBlock[];

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }).strict(),
  z.object({ type: z.literal('italic') }).strict(),
  z.object({ type: z.literal('underline') }).strict(),
  z.object({ type: z.literal('strike') }).strict(),
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
    hardBreak: z.literal(true).optional(),
    marks: z.array(markSchema).max(6).optional(),
  })
  .strict();

const runsSchema = z.array(runSchema).max(MAX_RUNS);
const alignmentSchema = z.enum(['left', 'center', 'right', 'justify']);
const mediaUrlSchema = z
  .string()
  .min(1)
  .max(4000)
  .refine((value) => /^(https?:|\/(?!\/)|\.{1,2}\/)/i.test(value.trim()), {
    message: 'Media URL must be http(s) or a relative path',
  });
const imageUrlSchema = z
  .string()
  .min(1)
  .max(14_000_000)
  .refine((value) => SAFE_IMAGE.test(value.trim()), {
    message: 'Image URL must be http(s), relative, or an allowed image data URL',
  });

  export const createRichTextBlock = (type: RichTextBlock['type']): RichTextBlock => {
    const id = newId();
    switch (type) {
      case 'paragraph':
        return createParagraph();
      case 'heading':
        return createHeading();
      case 'list':
        return createList();
      case 'blockquote':
        return { id, type, children: [createParagraph()] };
      case 'code-block':
        return { id, type, text: '', language: 'plaintext' };
      case 'divider':
        return { id, type };
      case 'callout':
        return { id, type, variant: 'info', children: [createParagraph()] };
      case 'columns':
        return {
          id,
          type,
          columns: [0, 1].map(() => ({ id: newId(), children: [createParagraph()] })),
        };
      case 'accordion':
        return { id, type, title: 'Details', children: [createParagraph()] };
      case 'image':
        return { id, type, src: '', alt: '' };
      case 'audio':
        return { id, type, src: '' };
      case 'video':
        return { id, type, src: '' };
      case 'youtube':
        return { id, type, videoId: '', title: 'YouTube video' };
      case 'vimeo':
        return { id, type, src: '', title: 'Vimeo video' };
      case 'iframe':
        return { id, type, src: '', title: 'Embedded content', width: '100%', height: '400' };
    }
  };
const dimensionsSchema = {
  width: z.number().int().min(1).max(4096).optional(),
  height: z.number().int().min(1).max(4096).optional(),
};

const richBlockSchema: z.ZodType<RichTextBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      id: z.string().min(1),
      type: z.literal('paragraph'),
      children: runsSchema,
      textAlign: alignmentSchema.optional(),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('heading'),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      children: runsSchema,
      textAlign: alignmentSchema.optional(),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('list'),
      ordered: z.boolean(),
      start: z.number().int().min(1).max(1_000_000).optional(),
      items: z.array(z.object({
        id: z.string().min(1),
        children: runsSchema,
        blocks: z.array(richBlockSchema).max(MAX_RICH_BLOCKS).optional(),
      }).strict()).max(MAX_LIST_ITEMS),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('blockquote'),
      children: z.array(richBlockSchema).max(MAX_RICH_BLOCKS),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('code-block'),
      text: z.string().max(100_000),
      language: z.string().max(40).optional(),
    }).strict(),
    z.object({ id: z.string().min(1), type: z.literal('divider') }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('callout'),
      variant: z.enum(['info', 'warning', 'success']),
      children: z.array(richBlockSchema).max(MAX_RICH_BLOCKS),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('columns'),
      columns: z.array(z.object({
        id: z.string().min(1),
        width: z.number().min(1).max(100).optional(),
        children: z.array(richBlockSchema).max(MAX_RICH_BLOCKS),
      }).strict()).min(2).max(3),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('accordion'),
      title: z.string().max(500),
      children: z.array(richBlockSchema).max(MAX_RICH_BLOCKS),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('image'),
      src: imageUrlSchema,
      alt: z.string().max(1000).refine((value) => value.trim() !== '', 'Image alt text is required'),
      title: z.string().max(500).optional(),
      align: z.enum(['left', 'center', 'right']).optional(),
      ...dimensionsSchema,
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('audio'),
      src: mediaUrlSchema,
      title: z.string().max(500).optional(),
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('video'),
      src: mediaUrlSchema,
      title: z.string().max(500).optional(),
      poster: mediaUrlSchema.optional(),
      ...dimensionsSchema,
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('youtube'),
      videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
      title: z.string().max(500).optional(),
      ...dimensionsSchema,
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('vimeo'),
      src: z.string().max(4000).refine(
        (value) => /^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?\d+(?:[/?#].*)?$/i.test(value),
        { message: 'Vimeo URL must point to a video on vimeo.com' },
      ),
      title: z.string().max(500).optional(),
      ...dimensionsSchema,
    }).strict(),
    z.object({
      id: z.string().min(1),
      type: z.literal('iframe'),
      src: z.string().max(4000).refine((value) => /^https?:\/\//i.test(value), {
        message: 'Embed URL must use http(s)',
      }),
      title: z.string().max(500).optional(),
      width: z.string().max(40).optional(),
      height: z.string().max(40).optional(),
    }).strict(),
  ]),
);

export const richTextSchema = z.array(richBlockSchema).max(MAX_RICH_BLOCKS);

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

export const runsToPlainText = (runs: TextRun[]) =>
  runs.map((run) => `${run.text}${run.hardBreak ? '\n' : ''}`).join('');

export const richTextToPlainText = (doc: RichTextDoc): string =>
  doc.map(plainTextOf).filter((text) => text !== '').join('\n\n');

const plainTextOf = (block: RichTextBlock): string => {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return block.children.map((run) => run.hardBreak ? `${run.text}\n` : run.text).join('');
    case 'list':
      return block.items.map((item) =>
        item.blocks?.length ? item.blocks.map(plainTextOf).join('\n') : runsToPlainText(item.children),
      ).join('\n');
    case 'blockquote':
    case 'callout':
    case 'accordion':
      return block.children.map(plainTextOf).join('\n');
    case 'columns':
      return block.columns.map((column) => column.children.map(plainTextOf).join('\n')).join('\n');
    case 'code-block':
      return block.text;
    case 'image':
      return block.alt;
    case 'divider':
    case 'audio':
    case 'video':
    case 'youtube':
    case 'vimeo':
    case 'iframe':
      return '';
  }
};

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
    const visit = (block: RichTextBlock, depth: number) => {
      check(block.id);
      if (block.type === 'image' && block.alt.trim() === '') {
        errors.push(`Image "${block.id}" requires alt text.`);
      }
      if (depth > MAX_RICH_TEXT_DEPTH) {
        errors.push(`Rich text block "${block.id}" is nested deeper than ${MAX_RICH_TEXT_DEPTH} levels.`);
        return;
      }
      if (block.type === 'list') {
        block.items.forEach((item) => {
          check(item.id);
          item.blocks?.forEach((child) => visit(child, depth + 1));
        });
      } else if (block.type === 'blockquote' || block.type === 'callout' || block.type === 'accordion') {
        block.children.forEach((child) => visit(child, depth + 1));
      } else if (block.type === 'columns') {
        block.columns.forEach((column) => {
          check(column.id);
          column.children.forEach((child) => visit(child, depth + 1));
        });
      }
    };
    result.data.forEach((block) => visit(block, 0));
    return errors;
  }
  return result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `Rich text ${path}: ${issue.message}` : `Rich text: ${issue.message}`;
  });
};
