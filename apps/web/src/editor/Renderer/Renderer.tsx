import { createRoot } from 'react-dom/client';
import { PageDocumentRenderer } from '@page-builder/ui/renderer';
import type { PageDocument, ThemeColors } from '@page-builder/ui/renderer';
import styles from './Renderer.module.css';

export interface MountRendererOptions {
  container: HTMLElement;
  document: PageDocument;
  theme: ThemeColors;
  assetBasePath?: string;
  asLandmark?: boolean;
}

export interface RendererHandle {
  unmount(): void;
}

/** Mounts only the read-only renderer with its isolated bundled React root. */
export const mountRenderer = ({
  container,
  document,
  theme,
  assetBasePath,
  asLandmark = true,
}: MountRendererOptions): RendererHandle => {
  const root = createRoot(container);
  root.render(
    <div className={styles.root}>
      <PageDocumentRenderer
        document={document}
        theme={theme}
        assetBasePath={assetBasePath}
        asLandmark={asLandmark}
      />
    </div>,
  );
  return { unmount: () => root.unmount() };
};
