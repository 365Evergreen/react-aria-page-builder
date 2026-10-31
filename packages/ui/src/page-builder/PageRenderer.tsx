import type { ComponentType } from 'react';
import type { PageBlockConfig } from './block-configs';
import type { BlockComponentProps, ThemeColors } from './types';
import { BlockRegistry, isRegisteredBlockType } from './registry';
import { ThemeInjector } from './ThemeInjector';

interface PageRendererProps {
  blocks: PageBlockConfig[];
  theme: ThemeColors;
  isEditing?: boolean;
  /** Render as a plain container when embedded inside another landmark. */
  asLandmark?: boolean;
}

export const PageRenderer = ({
  blocks,
  theme,
  isEditing = false,
  asLandmark = true,
}: PageRendererProps) => {
  const Wrapper = asLandmark ? 'main' : 'div';
  const firstHeroId = blocks.find((block) => block.type === 'hero-banner')?.id;
  const firstPostId = firstHeroId
    ? undefined
    : blocks.find((block) => block.type === 'post-body')?.id;

  return (
  <ThemeInjector theme={theme}>
    <Wrapper className="page-layout-wrapper">
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
          BlockComponentProps<PageBlockConfig> & { headingLevel?: 1 | 2 }
        >;

        const extraProps =
          block.type === 'hero-banner'
            ? { headingLevel: (block.id === firstHeroId ? 1 : 2) as 1 | 2 }
            : block.type === 'post-body'
              ? { headingLevel: (block.id === firstPostId ? 1 : 2) as 1 | 2 }
              : {};

        return <ComponentToRender key={block.id} config={block} {...extraProps} />;
      })}
    </Wrapper>
  </ThemeInjector>
  );
};

