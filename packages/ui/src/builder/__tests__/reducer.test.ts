import { describe, expect, it } from 'vitest';
import { resolvePlacement } from '../dnd';
import { createNode } from '../definitions';
import {
  builderReducer,
  createInitialState,
  type BuilderAction,
  type BuilderState,
} from '../reducer';
import { findNode, type PageTree } from '../model';

const run = (state: BuilderState, ...actions: BuilderAction[]) =>
  actions.reduce(builderReducer, state);

const ids = (tree: PageTree) => tree.map((n) => n.id);

const seed = () =>
  createInitialState([
    createNode('hero-banner', 'a'),
    createNode('media-gallery', 'b'),
    createNode('container', 'c'),
  ]);

describe('builderReducer', () => {
  it('adds blocks at an index and selects them', () => {
    const s = run(seed(), {
      type: 'add', blockType: 'grid-section', parentId: null, index: 1, id: 'n',
    });
    expect(ids(s.tree)).toEqual(['a', 'n', 'b', 'c']);
    expect(s.selectedId).toBe('n');
    expect(s.focusId).toBe('n');
    expect(s.announcement).toMatch(/added, position 2 of 4/);
  });

  it('adds into containers only', () => {
    const ok = run(seed(), {
      type: 'add', blockType: 'hero-banner', parentId: 'c', index: 0, id: 'n',
    });
    expect(findNode(ok.tree, 'n')?.parentId).toBe('c');
    const bad = run(seed(), {
      type: 'add', blockType: 'hero-banner', parentId: 'a', index: 0, id: 'n',
    });
    expect(bad.tree).toEqual(seed().tree);
  });

  it('ignores unknown block types', () => {
    const s = run(seed(), {
      type: 'add', blockType: 'nope', parentId: null, index: 0,
    });
    expect(s.tree).toHaveLength(3);
  });

  it('moves within and across parents using post-removal indexes', () => {
    let s = run(seed(), { type: 'move', id: 'a', parentId: null, index: 1 });
    expect(ids(s.tree)).toEqual(['b', 'a', 'c']);
    s = run(s, { type: 'move', id: 'b', parentId: 'c', index: 0 });
    expect(ids(s.tree)).toEqual(['a', 'c']);
    expect(findNode(s.tree, 'b')?.parentId).toBe('c');
  });

  it('refuses to move a block into its own descendant', () => {
    const base = run(seed(), {
      type: 'add', blockType: 'container', parentId: 'c', index: 0, id: 'inner',
    });
    const s = run(base, { type: 'move', id: 'c', parentId: 'inner', index: 0 });
    expect(s.tree).toEqual(base.tree);
    expect(s.announcement).toMatch(/cannot be moved/);
  });

  it('moveBy swaps siblings and announces edges', () => {
    let s = run(seed(), { type: 'moveBy', id: 'b', delta: -1 });
    expect(ids(s.tree)).toEqual(['b', 'a', 'c']);
    s = run(s, { type: 'moveBy', id: 'b', delta: -1 });
    expect(ids(s.tree)).toEqual(['b', 'a', 'c']);
    expect(s.announcement).toMatch(/already first/);
  });

  it('removes and moves selection to a neighbour', () => {
    const s = run(seed(), { type: 'remove', id: 'a' });
    expect(ids(s.tree)).toEqual(['b', 'c']);
    expect(s.selectedId).toBe('b');
    const last = run(seed(), { type: 'remove', id: 'c' });
    expect(last.selectedId).toBe('b');
  });

  it('removing a lone child selects the parent', () => {
    const s = run(
      seed(),
      { type: 'add', blockType: 'hero-banner', parentId: 'c', index: 0, id: 'k' },
      { type: 'remove', id: 'k' },
    );
    expect(s.selectedId).toBe('c');
  });

  it('duplicates deeply with fresh ids', () => {
    let n = 0;
    const base = run(seed(), {
      type: 'add', blockType: 'hero-banner', parentId: 'c', index: 0, id: 'k',
    });
    const s = run(base, { type: 'duplicate', id: 'c', newId: () => `copy${++n}` });
    expect(ids(s.tree)).toEqual(['a', 'b', 'c', 'copy1']);
    expect(s.tree[3].children[0].id).toBe('copy2');
    expect(s.selectedId).toBe('copy1');
    s.tree[3].children[0].props.data!.title = 'changed';
    expect(findNode(s.tree, 'k')?.node.props.data?.title).not.toBe('changed');
  });

  it('undoes and redoes, clearing redo on new edits', () => {
    let s = run(
      seed(),
      { type: 'remove', id: 'a' },
      { type: 'remove', id: 'b' },
    );
    s = run(s, { type: 'undo' });
    expect(ids(s.tree)).toEqual(['b', 'c']);
    s = run(s, { type: 'undo' });
    expect(ids(s.tree)).toEqual(['a', 'b', 'c']);
    s = run(s, { type: 'undo' });
    expect(s.announcement).toBe('Nothing to undo.');
    s = run(s, { type: 'redo' });
    expect(ids(s.tree)).toEqual(['b', 'c']);
    s = run(s, { type: 'move', id: 'b', parentId: null, index: 1 });
    expect(s.future).toHaveLength(0);
    expect(run(s, { type: 'redo' }).announcement).toBe('Nothing to redo.');
  });

  it('coalesces consecutive edits of the same field into one undo step', () => {
    let s = run(
      seed(),
      { type: 'update', id: 'a', field: 'title', value: 'H' },
      { type: 'update', id: 'a', field: 'title', value: 'He' },
      { type: 'update', id: 'a', field: 'title', value: 'Hey' },
    );
    expect(s.past).toHaveLength(1);
    expect(findNode(s.tree, 'a')?.node.props.data?.title).toBe('Hey');
    s = run(s, { type: 'undo' });
    expect(findNode(s.tree, 'a')?.node.props.data?.title).toBe('New page');
  });

  it('does not push history for selection', () => {
    const s = run(seed(), { type: 'select', id: 'b' });
    expect(s.past).toHaveLength(0);
    expect(s.selectedId).toBe('b');
  });
});

describe('resolvePlacement', () => {
  const tree = seed().tree;

  it('resolves before/after relative to siblings, excluding the dragged node', () => {
    expect(
      resolvePlacement(tree, { type: 'item', key: 'c', dropPosition: 'before' }, 'a'),
    ).toEqual({ parentId: null, index: 1 });
    expect(
      resolvePlacement(tree, { type: 'item', key: 'b', dropPosition: 'after' }),
    ).toEqual({ parentId: null, index: 2 });
  });

  it('resolves on-drops only for containers', () => {
    expect(
      resolvePlacement(tree, { type: 'item', key: 'c', dropPosition: 'on' }),
    ).toEqual({ parentId: 'c', index: 0 });
    expect(
      resolvePlacement(tree, { type: 'item', key: 'a', dropPosition: 'on' }),
    ).toBeNull();
  });

  it('resolves the root', () => {
    expect(resolvePlacement(tree, { type: 'root' })).toEqual({ parentId: null, index: 3 });
  });
});
