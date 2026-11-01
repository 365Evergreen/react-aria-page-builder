import { describe, expect, it } from 'vitest';
import {
  createHeading,
  createList,
  createParagraph,
  createRun,
  getLinkHref,
  hasMark,
  richTextToPlainText,
  setLink,
  toggleMark,
  validateRichText,
  type RichTextDoc,
} from '../rich-text';
import {
  countWords,
  createPostBodyData,
  postExcerpt,
  readingTimeMinutes,
} from '../post-body';
import { pageLayoutSchema } from '../page-schema';
import { createNode } from '../../builder/definitions';
import { parsePage, serializePage, validateTree } from '../../builder/persistence';

describe('rich text model', () => {
  it('accepts headings, paragraphs and lists with marks', () => {
    const doc: RichTextDoc = [
      createHeading('Title', 2),
      {
        id: 'p1',
        type: 'paragraph',
        children: [
          { text: 'Plain ' },
          { text: 'bold', marks: [{ type: 'bold' }, { type: 'italic' }] },
          { text: 'code', marks: [{ type: 'code' }] },
          { text: 'link', marks: [{ type: 'link', href: 'https://example.com/a' }] },
        ],
      },
      createList(['one', 'two'], true),
    ];
    expect(validateRichText(doc)).toEqual([]);
  });

  it('rejects unsafe links and unknown shapes', () => {
    const bad = (value: unknown) => validateRichText(value).length > 0;
    expect(
      bad([
        {
          id: 'a',
          type: 'paragraph',
          children: [{ text: 'x', marks: [{ type: 'link', href: 'javascript:alert(1)' }] }],
        },
      ]),
    ).toBe(true);
    expect(bad([{ id: 'a', type: 'html', children: [] }])).toBe(true);
    expect(bad([{ id: 'a', type: 'paragraph', children: [{ text: 'x', style: 'color:red' }] }])).toBe(true);
  });

  it('rejects duplicate ids', () => {
    const doc = [
      { id: 'same', type: 'paragraph', children: [] },
      { id: 'same', type: 'paragraph', children: [] },
    ];
    expect(validateRichText(doc).length).toBeGreaterThan(0);
  });

  it('toggles marks and links without mutating', () => {
    const run = createRun('hi');
    const bold = toggleMark(run, 'bold', true);
    expect(hasMark(bold, 'bold')).toBe(true);
    expect(hasMark(run, 'bold')).toBe(false);
    expect(hasMark(toggleMark(bold, 'bold', false), 'bold')).toBe(false);
    const linked = setLink(bold, 'https://example.com');
    expect(getLinkHref(linked)).toBe('https://example.com');
    expect(hasMark(linked, 'bold')).toBe(true);
  });

  it('extracts plain text', () => {
    const text = richTextToPlainText([createHeading('Head'), createParagraph('Body text')]);
    expect(text).toContain('Head');
    expect(text).toContain('Body text');
  });
});

describe('post body', () => {
  it('has valid defaults and counts words', () => {
    expect(validateRichText(createPostBodyData().content)).toEqual([]);
    expect(countWords({ content: [createParagraph('one two  three')] })).toBe(3);
    expect(readingTimeMinutes({ content: [] })).toBeGreaterThanOrEqual(1);
    expect(postExcerpt({ content: [createParagraph('x'.repeat(300))] }, 50).length).toBeLessThanOrEqual(51);
  });

  it('validates as a page block', () => {
    const ok = { id: 'b', type: 'post-body', data: createPostBodyData() };
    expect(pageLayoutSchema.safeParse([ok]).success).toBe(true);
  });
});

describe('rich-text blocks in the versioned document', () => {
  it('round-trips through v1 JSON', () => {
    const tree = [createNode('rich-text', 'r'), createNode('post-body', 'p')];
    const saved = serializePage(tree);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(JSON.parse(saved.json).version).toBe(1);
    expect(parsePage(saved.json)).toEqual({ ok: true, tree });
  });

  it('rejects an unsafe link in a saved tree', () => {
    const node = createNode('rich-text', 'r');
    node.props.data = {
      content: [
        {
          id: 'x',
          type: 'paragraph',
          children: [{ text: 't', marks: [{ type: 'link', href: 'javascript:alert(1)' }] }],
        },
      ],
    };
    expect(validateTree([node]).length).toBeGreaterThan(0);
  });
});
