import { useMemo, useState } from 'react';
import { useDragAndDrop } from 'react-aria-components/useDragAndDrop';
import { GridList, GridListItem, Text } from '../primitives/GridList/GridList';
import { SearchField } from '../primitives/SearchField/SearchField';
import { blockDefinitions } from './definitions';
import { BLOCK_DRAG_TYPE } from './dnd';

interface BlockPaletteProps {
  onInsert: (blockType: string) => void;
}

export function BlockPalette({ onInsert }: BlockPaletteProps) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return blockDefinitions;
    return blockDefinitions.filter((definition) =>
      `${definition.name} ${definition.description} ${definition.category}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => {
        const name = blockDefinitions.find((d) => d.type === key)?.name ?? '';
        return { [BLOCK_DRAG_TYPE]: String(key), 'text/plain': name };
      }),
    getAllowedDropOperations: () => ['copy'],
  });

  return (
    <section className="pb-palette" aria-labelledby="pb-palette-title">
      <h2 id="pb-palette-title">Blocks</h2>
      <SearchField
        label="Search blocks"
        value={query}
        onChange={setQuery}
      />
      <p id="pb-palette-help" className="pb-help">
        Press Enter on a block to insert it. To drag, use the block's drag handle with the mouse, or focus the handle, press Enter, then move to the canvas and press Enter again.
      </p>
      <GridList
        aria-label="Available blocks"
        aria-describedby="pb-palette-help"
        layout="stack"
        items={visible}
        dragAndDropHooks={dragAndDropHooks}
        onAction={(key) => onInsert(String(key))}
        renderEmptyState={() => <span role="status">No blocks match “{query}”.</span>}
        className="pb-palette-list"
      >
        {(definition) => (
          <GridListItem
            id={definition.type}
            textValue={definition.name}
            className="pb-palette-item"
          >
            <span className="pb-palette-name">{definition.name}</span>
            <Text slot="description">{definition.description}</Text>
          </GridListItem>
        )}
      </GridList>    </section>
  );
}


