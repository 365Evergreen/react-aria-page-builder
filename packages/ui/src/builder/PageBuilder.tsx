import { useCallback, useMemo, useReducer, useState } from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { Button } from '../primitives/Button/Button';
import { Toolbar } from '../primitives/Toolbar/Toolbar';
import { PageRenderer } from '../page-builder/PageRenderer';
import type { PageBlockConfig } from '../page-builder/block-configs';
import { isRegisteredBlockType } from '../page-builder/registry';
import type { ThemeColors } from '../page-builder/types';
import { BlockCanvas } from './BlockCanvas';
import { BlockPalette } from './BlockPalette';
import { canHaveChildren } from './definitions';
import { findNode, flattenTree, getSiblings, type PageTree } from './model';
import { PropsPanel } from './PropsPanel';
import { builderReducer, createInitialState } from './reducer';
import './builder.css';

interface PageBuilderProps {
  initialTree?: PageTree;
  theme: ThemeColors;
}

export const blocksToTree = (blocks: PageBlockConfig[]): PageTree =>
  blocks.map((block) => ({
    id: block.id,
    type: block.type,
    props: { data: block.data as Record<string, unknown>, styles: block.styles },
    children: [],
  }));

export const treeToBlocks = (tree: PageTree): PageBlockConfig[] =>
  flattenTree(tree)
    .filter((node) => isRegisteredBlockType(node.type))
    .map(
      (node) =>
        ({
          id: node.id,
          type: node.type,
          styles: node.props.styles,
          data: node.props.data,
        }) as PageBlockConfig,
    );

export function PageBuilder({ initialTree = [], theme }: PageBuilderProps) {
  const [state, dispatch] = useReducer(
    builderReducer,
    initialTree,
    createInitialState,
  );
  const [showPreview, setShowPreview] = useState(false);
  const { tree, selectedId } = state;

  const selected = selectedId ? findNode(tree, selectedId) : null;
  const siblings = selected ? getSiblings(tree, selected.parentId) : [];

  const insertAtSelection = useCallback(
    (blockType: string) => {
      if (selected && canHaveChildren(selected.node.type)) {
        dispatch({
          type: 'add',
          blockType,
          parentId: selected.node.id,
          index: selected.node.children.length,
        });
      } else if (selected) {
        dispatch({
          type: 'add',
          blockType,
          parentId: selected.parentId,
          index: selected.index + 1,
        });
      } else {
        dispatch({ type: 'add', blockType, parentId: null, index: tree.length });
      }
    },
    [selected, tree.length],
  );

  const blocks = useMemo(() => treeToBlocks(tree), [tree]);
  const id = selectedId ?? '';

  return (
    <div className="pb-shell">
      <div className="pb-live pb-visually-hidden" role="status" aria-live="polite">
        {state.announcement}
      </div>

      <aside className="pb-sidebar" aria-label="Block library">
        <BlockPalette onInsert={insertAtSelection} />
      </aside>

      <section className="pb-main" aria-labelledby="pb-canvas-title">
        <h2 id="pb-canvas-title">Canvas</h2>
        <Toolbar aria-label="Block actions" className="pb-toolbar">
          <Button
            variant="secondary"
            isDisabled={state.past.length === 0}
            onPress={() => dispatch({ type: 'undo' })}
          >
            <Undo2 size={16} aria-hidden="true" /> Undo
          </Button>
          <Button
            variant="secondary"
            isDisabled={state.future.length === 0}
            onPress={() => dispatch({ type: 'redo' })}
          >
            <Redo2 size={16} aria-hidden="true" /> Redo
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected || selected.index === 0}
            onPress={() => dispatch({ type: 'moveBy', id, delta: -1 })}
          >
            Move up
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected || selected.index >= siblings.length - 1}
            onPress={() => dispatch({ type: 'moveBy', id, delta: 1 })}
          >
            Move down
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected}
            onPress={() => dispatch({ type: 'duplicate', id })}
          >
            Duplicate
          </Button>
          <Button
            variant="secondary"
            isDisabled={!selected}
            onPress={() => dispatch({ type: 'remove', id })}
          >
            Delete
          </Button>
          <Button variant="quiet" onPress={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Button>
        </Toolbar>
        <p id="pb-canvas-help" className="pb-help">
          Arrow keys move between blocks, Home and End jump to the first and last.
          Alt+Up/Down moves the selected block, Ctrl+D duplicates, Delete removes,
          Ctrl+Z undoes. To drag with the keyboard, focus a block's drag handle and
          press Enter.
        </p>
        <BlockCanvas
          tree={tree}
          selectedId={selectedId}
          focusId={state.focusId}
          dispatch={dispatch}
        />
        {showPreview && (
          <section className="pb-preview" aria-label="Page preview">
            <PageRenderer blocks={blocks} theme={theme} isEditing asLandmark={false} />
          </section>
        )}
      </section>

      <aside className="pb-sidebar" aria-label="Block inspector">
        <PropsPanel tree={tree} selectedId={selectedId} dispatch={dispatch} />
      </aside>
    </div>
  );
}



