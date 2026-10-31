import { useMemo, useState } from 'react';
import { useDragAndDrop } from 'react-aria-components/useDragAndDrop';
import { ListBox, ListBoxItem, Text } from '../primitives/ListBox/ListBox';
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
        Press Enter or Space to insert a block, or drag it onto the canvas.
      </p>
      <div
        onKeyDownCapture={(event) => {
          if (event.key !== ' ') return;
          const option = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]');
          if (!option?.dataset.key) return;
          event.preventDefault();
          onInsert(option.dataset.key);
        }}
      >
      <ListBox
        aria-label="Available blocks"
        aria-describedby="pb-palette-help"
        items={visible}
        dragAndDropHooks={dragAndDropHooks}
        onAction={(key) => onInsert(String(key))}
        renderEmptyState={() => <span role="status">No blocks match “{query}”.</span>}
        className="pb-palette-list"
      >
        {(definition) => (
          <ListBoxItem
            id={definition.type}
            textValue={definition.name}
            className="pb-palette-item"
          >
            <Text slot="label">{definition.name}</Text>
            <Text slot="description">{definition.description}</Text>
          </ListBoxItem>
        )}
      </ListBox>
      </div>
    </section>
  );
}


