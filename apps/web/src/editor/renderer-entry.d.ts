import type { PageDocument, ThemeColors } from './editor.js';

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

export declare function mountRenderer(options: MountRendererOptions): RendererHandle;
