import { describe, expect, it } from 'vitest';
import { createNode } from '../definitions';
import { parsePage, serializePage, validateTree } from '../persistence';

const sample = () => {
  const container = createNode('container', 'c');
  container.children = [createNode('hero-banner', 'h')];
  return [container, createNode('media-gallery', 'g')];
};

describe('persistence', () => {
  it('round-trips a versioned document', () => {
    const tree = sample();
    const saved = serializePage(tree);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(JSON.parse(saved.json)).toMatchObject({
      format: 'react-aria-page-builder',
      version: 1,
    });
    expect(parsePage(saved.json)).toEqual({ ok: true, tree });
  });

  it('rejects invalid JSON, wrong format and newer versions', () => {
    expect(parsePage('{nope').ok).toBe(false);
    expect(parsePage('{"hello":1}').ok).toBe(false);
    const future = JSON.stringify({ format: 'react-aria-page-builder', version: 99, tree: [] });
    expect(parsePage(future)).toMatchObject({ ok: false });
  });

  it('rejects unsafe URLs, unknown types and misplaced children', () => {
    const hero = createNode('hero-banner', 'h');
    hero.props.data = { ...hero.props.data, buttonUrl: 'javascript:alert(1)' };
    expect(validateTree([hero]).join()).toMatch(/URL must be/);
    const unknown = { ...createNode('container', 'u'), type: 'script' };
    expect(validateTree([unknown]).join()).toMatch(/unknown block type/);
    const bad = createNode('hero-banner', 'b');
    bad.children = [createNode('container', 'x')];
    expect(validateTree([bad]).join()).toMatch(/cannot contain/);
  });

  it('requires alt text unless an image is decorative', () => {
    const gallery = createNode('media-gallery', 'g');
    gallery.props.data = {
      ...gallery.props.data,
      items: [{ id: 'i', src: 'https://e.com/a.png', alt: '' }],
    };
    expect(validateTree([gallery]).join()).toMatch(/alt/i);
  });

  it('imports the legacy flat page definition', async () => {
    const example = await import('../../../../../apps/web/src/example-page.json');
    const result = parsePage(JSON.stringify(example.default));
    expect(result.ok).toBe(true);
  });
});
