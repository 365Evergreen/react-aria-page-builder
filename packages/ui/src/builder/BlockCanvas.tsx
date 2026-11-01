import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Selection } from 'react-aria-components/Tree';
import {
  isTextDropItem,
  useDragAndDrop,
  type DropItem,
  type ItemDropTarget,
} from 'react-aria-components/useDragAndDrop';
import { PageRenderer } from '../page-builder/PageRenderer';
import type { ThemeColors } from '../page-builder/types';
import { Tree, TreeItem } from '../primitives/Tree/Tree';
import { nodeToBlock } from './blocks';
import { canHaveChildren, getDefinition, getNodeLabel } from './definitions';
import { BLOCK_DRAG_TYPE, NODE_DRAG_TYPE, resolvePlacement } from './dnd';
import { findNode, type PageNode, type PageTree } from './model';
import type { BuilderAction } from './reducer';

interface BlockCanvasProps {
  tree: PageTree;
  selectedId: string | null;
  focusId: string | null;
  theme: ThemeColors;
  dispatch: (action: BuilderAction) => void;
}

const collectContainerIds = (tree: PageTree): string[] =>
  tree.flatMap((node) => [
    ...(node.children.length > 0 || canHaveChildren(node.type) ? [node.id] : []),
    ...collectContainerIds(node.children),
  ]);

const NodePreview = memo(function NodePreview({
  node,
  theme,
}: {
  node: PageNode;
  theme: ThemeColors;
}) {
  const block = nodeToBlock(node);
  if (!block) return null;
  return (
    // Decorative render of the block; the row's own label is its accessible name.
    <span className="pb-node-preview" aria-hidden="true" {...{ inert: true }}>
      <PageRenderer blocks={[block]} theme={theme} asLandmark={false} />
    </span>
  );
});

function renderNode(node: PageNode, theme: ThemeColors) {
  const definition = getDefinition(node.type);
  return (
    <TreeItem
      key={node.id}
      id={node.id}
      textValue={getNodeLabel(node)}
      title={
        <span className="pb-node">
          <span className="pb-node-label">{getNodeLabel(node)}</span>
          <span className="pb-node-type">{definition?.category ?? 'unknown'}</span>
          <NodePreview node={node} theme={theme} />
        </span>
      }
    >
      {node.children.map((child) => renderNode(child, theme))}
    </TreeItem>
  );
}
export function BlockCanvas({
  tree,
  selectedId,
  focusId,
  theme,
  dispatch,
}: BlockCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    const fresh = collectContainerIds(tree).filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    setExpanded((current) => new Set([...current, ...fresh]));
  }, [tree]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!focusId || !wrapper) return;
    // The collection renders its rows after this component commits, so wait for the row.
    const tryFocus = () => {
      const row = [...wrapper.querySelectorAll<HTMLElement>('[data-key]')].find(
        (element) => element.dataset.key === focusId,
      );
      if (!row) return false;
      row.focus();
      dispatch({ type: 'clearFocus' });
      return true;
    };
    if (tryFocus()) return;
    const observer = new MutationObserver(() => {
      if (tryFocus()) observer.disconnect();
    });
    observer.observe(wrapper, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [focusId, tree, dispatch]);

  const handleDrop = async (
    items: DropItem[],
    target: ItemDropTarget | { type: 'root' },
    movedKeys?: Iterable<string | number>,
  ) => {
    const moved = movedKeys ? [...movedKeys].map(String) : [];
    for (const id of moved) {
      const placement = resolvePlacement(tree, target, id);
      if (!placement) {
        dispatch({ type: 'move', id, parentId: '', index: 0 });
        return;
      }
      dispatch({ type: 'move', id, ...placement });
    }
    let offset = 0;
    for (const item of items) {
      if (!isTextDropItem(item)) continue;
      if (item.types.has(BLOCK_DRAG_TYPE)) {
        const blockType = await item.getText(BLOCK_DRAG_TYPE);
        const placement = resolvePlacement(tree, target);
        if (!placement) continue;
        dispatch({
          type: 'add',
          blockType,
          parentId: placement.parentId,
          index: placement.index + offset++,
        });
      } else if (item.types.has(NODE_DRAG_TYPE) && !movedKeys) {
        const id = await item.getText(NODE_DRAG_TYPE);
        const placement = resolvePlacement(tree, target, id);
        if (placement) dispatch({ type: 'move', id, ...placement });
      }
    }
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => {
        const found = findNode(tree, String(key));
        return {
          [NODE_DRAG_TYPE]: String(key),
          'text/plain': found ? getNodeLabel(found.node) : '',
        };
      }),
    getAllowedDropOperations: () => ['move', 'copy'],
    acceptedDragTypes: [BLOCK_DRAG_TYPE, NODE_DRAG_TYPE],
    getDropOperation: (target, types) => {
      if (target.type === 'item' && target.dropPosition === 'on') {
        const found = findNode(tree, String(target.key));
        if (!found || !canHaveChildren(found.node.type)) return 'cancel';
      }
      return types.has(BLOCK_DRAG_TYPE) ? 'copy' : 'move';
    },
    shouldAcceptItemDrop: (target) => {
      const found = findNode(tree, String(target.key));
      return !!found && canHaveChildren(found.node.type);
    },
    onReorder: (event) => {
      void handleDrop([], event.target, event.keys);
    },
    onInsert: (event) => {
      void handleDrop(event.items, event.target);
    },
    onItemDrop: (event) => {
      void handleDrop(event.items, event.target);
    },
    onRootDrop: (event) => {
      void handleDrop(event.items, { type: 'root' });
    },
  });

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[role="row"]');
    if (!row || !selectedId) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    let action: BuilderAction | null = null;

    if (event.altKey && !mod && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      action = { type: 'moveBy', id: selectedId, delta: event.key === 'ArrowUp' ? -1 : 1 };
    } else if (!mod && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
      action = { type: 'remove', id: selectedId };
    } else if (mod && key === 'd') {
      action = { type: 'duplicate', id: selectedId };
    } else if (mod && key === 'z') {
      action = { type: event.shiftKey ? 'redo' : 'undo' };
    } else if (mod && key === 'y') {
      action = { type: 'redo' };
    }

    if (action) {
      event.preventDefault();
      event.stopPropagation();
      dispatch(action);
    }
  };

  const onSelectionChange = (keys: Selection) => {
    if (keys === 'all') return;
    const [first] = keys;
    dispatch({ type: 'select', id: first === undefined ? null : String(first) });
  };

  return (
    <div
      ref={wrapperRef}
      className="pb-canvas"
      onKeyDownCapture={onKeyDownCapture}
    >
      <Tree
        aria-label="Page canvas"
        aria-describedby="pb-canvas-help"
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={selectedId ? [selectedId] : []}
        onSelectionChange={onSelectionChange}
        expandedKeys={expanded}
        onExpandedChange={(keys) => setExpanded(new Set(keys))}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => (
          <span>Canvas is empty. Add blocks from the palette.</span>
        )}
      >
        {tree.map((node) => renderNode(node, theme))}
      </Tree>
    </div>
  );
}
