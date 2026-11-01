import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichTextContent } from '../../primitives/RichText/RichText';
import {
  createHeading,
  createList,
  createParagraph,
  createRichTextBlock,
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
import { convertRichTextBlock } from '../../builder/RichTextEditor';
import { validatePageDocument } from '../document-schema';
import { createDocument } from '../../builder/persistence';

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

  it('validates active rich-text node and mark parity', () => {
    const doc: RichTextDoc = [
      {
        id: 'list',
        type: 'list',
        ordered: true,
        start: 3,
        items: [{
          id: 'item',
          children: [{
            text: 'formatted',
            hardBreak: true,
            marks: [
              { type: 'bold' },
              { type: 'italic' },
              { type: 'underline' },
              { type: 'strike' },
              { type: 'code' },
              { type: 'link', href: 'https://example.com' },
            ],
          }],
        }],
      },
      { id: 'quote', type: 'blockquote', children: [createParagraph('quoted')] },
      { id: 'callout', type: 'callout', variant: 'warning', children: [createParagraph('notice')] },
      { id: 'columns', type: 'columns', columns: [
        { id: 'left', width: 40, children: [createParagraph('left')] },
        { id: 'right', width: 60, children: [createParagraph('right')] },
      ] },
      { id: 'accordion', type: 'accordion', title: 'Details', children: [createParagraph('body')] },
      { id: 'code', type: 'code-block', language: 'typescript', text: 'const x = 1;' },
      { id: 'divider', type: 'divider' },
      { id: 'image', type: 'image', src: 'https://example.com/image.jpg', alt: 'Description', width: 640, height: 480 },
      { id: 'audio', type: 'audio', src: '/audio.mp3', title: 'Audio' },
      { id: 'video', type: 'video', src: '/video.mp4', title: 'Video' },
      { id: 'youtube', type: 'youtube', videoId: 'abcdefghijk', title: 'Video' },
      { id: 'vimeo', type: 'vimeo', src: 'https://vimeo.com/123456', title: 'Video' },
      { id: 'iframe', type: 'iframe', src: 'https://example.com/embed', title: 'Embedded content' },
    ];
    expect(validateRichText(doc)).toEqual([]);
    expect(validateRichText([createRichTextBlock('image')]).some((error) => error.includes('alt'))).toBe(true);
    expect(validateRichText([{ id: 'bad', type: 'iframe', src: 'javascript:alert(1)' }])).not.toEqual([]);
    const markup = renderToStaticMarkup(createElement(RichTextContent, { content: doc }));
    expect(markup).toContain('<ol start="3">');
    expect(markup).toContain('controls=""');
    expect(markup).toContain('sandbox="allow-scripts allow-presentation"');
    expect(markup).toContain('language-typescript');
  });

  it('converts every list item without dropping text or nested blocks', () => {
    const list: RichTextDoc = [{
      id: 'list',
      type: 'list',
      ordered: false,
      items: [
        { id: 'item-a', children: [createRun('first')] },
        { id: 'item-b', children: [createRun('second')], blocks: [createParagraph('nested')] },
      ],
    }];
    const listBlock = list[0];
    if (listBlock.type !== 'list') throw new Error('Expected list fixture.');
    const converted = convertRichTextBlock(listBlock, 'paragraph');
    expect(converted).toMatchObject([
      { id: 'list', type: 'paragraph', children: [{ text: 'first' }] },
      { id: 'item-b', type: 'paragraph', children: [{ text: 'second' }] },
      { type: 'paragraph', children: [{ text: 'nested' }] },
    ]);
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

  it('validates canonical JSON in the worker-safe schema module', () => {
    const result = validatePageDocument(createDocument([createNode('rich-text', 'schema')]));
    expect(result.ok).toBe(true);
    expect(validatePageDocument({ format: 'react-aria-page-builder', version: 1, tree: [], revision: 'stale' }).ok).toBe(false);
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
