import type { ItemDropTarget } from 'react-aria-components/useDragAndDrop';
import { canHaveChildren } from './definitions';
import { findNode, getSiblings, type PageTree } from './model';

export const BLOCK_DRAG_TYPE = 'application/x-page-builder-block';
export const NODE_DRAG_TYPE = 'application/x-page-builder-node';

export interface Placement {
  parentId: string | null;
  index: number;
}

/**
 * Resolves a drop target to a parent and a final index. `excludeId` is the node
 * being moved; it is ignored when counting so the index matches post-removal order.
 */
export const resolvePlacement = (
  tree: PageTree,
  target: ItemDropTarget | { type: 'root' },
  excludeId: string | null = null,
): Placement | null => {
  const without = (list: PageTree) =>
    excludeId ? list.filter((node) => node.id !== excludeId) : list;

  if (target.type === 'root') {
    return { parentId: null, index: without(tree).length };
  }

  const key = String(target.key);
  const found = findNode(tree, key);
  if (!found) return null;

  if (target.dropPosition === 'on') {
    if (!canHaveChildren(found.node.type)) return null;
    return { parentId: found.node.id, index: without(found.node.children).length };
  }

  const siblings = without(getSiblings(tree, found.parentId));
  const at = siblings.findIndex((node) => node.id === key);
  if (at < 0) return null;
  return {
    parentId: found.parentId,
    index: at + (target.dropPosition === 'after' ? 1 : 0),
  };
};
