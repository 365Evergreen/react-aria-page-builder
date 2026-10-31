import type { PageBlockConfig } from '../page-builder/block-configs';
import { isRegisteredBlockType } from '../page-builder/registry';
import { flattenTree, type PageNode, type PageTree } from './model';

export const nodeToBlock = (node: PageNode): PageBlockConfig | null =>
  isRegisteredBlockType(node.type)
    ? ({
        id: node.id,
        type: node.type,
        styles: node.props.styles,
        data: node.props.data,
      } as PageBlockConfig)
    : null;

export const blocksToTree = (blocks: PageBlockConfig[]): PageTree =>
  blocks.map((block) => ({
    id: block.id,
    type: block.type,
    props: { data: block.data as Record<string, unknown>, styles: block.styles },
    children: [],
  }));

export const treeToBlocks = (tree: PageTree): PageBlockConfig[] =>
  flattenTree(tree).flatMap((node) => nodeToBlock(node) ?? []);
