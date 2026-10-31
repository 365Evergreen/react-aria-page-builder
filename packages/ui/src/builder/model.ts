import type { CSSProperties } from 'react';

export interface NodeProps {
  data?: Record<string, unknown>;
  styles?: CSSProperties;
}

export interface PageNode {
  id: string;
  type: string;
  props: NodeProps;
  children: PageNode[];
}

export type PageTree = PageNode[];

export interface NodeLocation {
  node: PageNode;
  parentId: string | null;
  index: number;
}

export const findNode = (
  tree: PageTree,
  id: string,
  parentId: string | null = null,
): NodeLocation | null => {
  for (let index = 0; index < tree.length; index++) {
    const node = tree[index];
    if (node.id === id) return { node, parentId, index };
    const found = findNode(node.children, id, node.id);
    if (found) return found;
  }
  return null;
};

export const containsNode = (node: PageNode, id: string): boolean =>
  node.id === id || node.children.some((child) => containsNode(child, id));

export const getSiblings = (tree: PageTree, parentId: string | null): PageTree =>
  parentId === null ? tree : (findNode(tree, parentId)?.node.children ?? []);

const mapNode = (
  tree: PageTree,
  id: string,
  fn: (node: PageNode) => PageNode | null,
): PageTree =>
  tree.flatMap((node) => {
    if (node.id === id) {
      const next = fn(node);
      return next ? [next] : [];
    }
    return [{ ...node, children: mapNode(node.children, id, fn) }];
  });

export const removeFromTree = (tree: PageTree, id: string): PageTree =>
  mapNode(tree, id, () => null);

export const updateInTree = (
  tree: PageTree,
  id: string,
  fn: (node: PageNode) => PageNode,
): PageTree => mapNode(tree, id, fn);

export const insertIntoTree = (
  tree: PageTree,
  parentId: string | null,
  index: number,
  node: PageNode,
): PageTree => {
  const insertAt = (list: PageTree) => {
    const at = Math.max(0, Math.min(index, list.length));
    return [...list.slice(0, at), node, ...list.slice(at)];
  };
  if (parentId === null) return insertAt(tree);
  return updateInTree(tree, parentId, (parent) => ({
    ...parent,
    children: insertAt(parent.children),
  }));
};

export const cloneWithNewIds = (
  node: PageNode,
  newId: () => string,
): PageNode => ({
  ...structuredClone({ ...node, children: [] }),
  id: newId(),
  children: node.children.map((child) => cloneWithNewIds(child, newId)),
});

export const flattenTree = (tree: PageTree): PageNode[] =>
  tree.flatMap((node) => [node, ...flattenTree(node.children)]);
