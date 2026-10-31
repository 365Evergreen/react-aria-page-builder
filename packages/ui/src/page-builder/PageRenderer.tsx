import type { ComponentType } from 'react';
import type { PageBlockConfig } from './block-configs';
import type { BlockComponentProps, ThemeColors } from './types';
import { BlockRegistry, isRegisteredBlockType } from './registry';
import { ThemeInjector } from './ThemeInjector';

interface PageRendererProps {
  blocks: PageBlockConfig[];
  theme: ThemeColors;
  isEditing?: boolean;
}

export const PageRenderer = ({
  blocks,
  theme,
  isEditing = false,
}: PageRendererProps) => (
  <ThemeInjector theme={theme}>
    <main className="page-layout-wrapper">
      {blocks.map((block) => {
        if (!isRegisteredBlockType(block.type)) {
          return isEditing ? (
            <div key={block.id} role="alert" data-missing-block={block.type}>
              Unsupported block: {block.type}
            </div>
          ) : null;
        }

        const definition = BlockRegistry[block.type];
        const ComponentToRender = definition.component as ComponentType<
          BlockComponentProps<PageBlockConfig>
        >;

        return <ComponentToRender key={block.id} config={block} />;
      })}
    </main>
  </ThemeInjector>
);
