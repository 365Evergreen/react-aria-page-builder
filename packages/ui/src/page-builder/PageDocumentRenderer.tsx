import type { PageDocument } from '../builder/persistence';
import { PageRenderer } from './PageRenderer';
import { isRegisteredBlockType } from './registry';
import type { PageBlockConfig } from './block-configs';
import type { ThemeColors } from './types';

export interface PageDocumentRendererProps {
  document: PageDocument;
  theme: ThemeColors;
  assetBasePath?: string;
  asLandmark?: boolean;
}

const flattenDocumentTree = (nodes: PageDocument['tree']): PageBlockConfig[] =>
  nodes.flatMap((node) => [
    ...(isRegisteredBlockType(node.type)
      ? [{
          id: node.id,
          type: node.type,
          styles: node.props.styles,
          data: node.props.data,
        } as PageBlockConfig]
      : []),
    ...flattenDocumentTree(node.children),
  ]);

/** Read-only renderer for validated canonical JSON documents. */
export const PageDocumentRenderer = ({
  document,
  theme,
  assetBasePath,
  asLandmark = true,
}: PageDocumentRendererProps) => (
  <PageRenderer
    blocks={flattenDocumentTree(document.tree)}
    theme={theme}
    assetBasePath={assetBasePath}
    asLandmark={asLandmark}
  />
);
