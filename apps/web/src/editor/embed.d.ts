export type DocumentKind = 'page' | 'post';
export type DocumentId = string | number;

export interface DocumentIdentity {
  kind: DocumentKind;
  id: DocumentId;
}

export interface PageNode {
  id: string;
  type: string;
  props: {
    data?: Record<string, unknown>;
    styles?: Record<string, string | number>;
  };
  children: PageNode[];
}

export interface PageDocument {
  format: 'react-aria-page-builder';
  version: number;
  savedAt?: string;
  tree: PageNode[];
}

export interface PageStoreSnapshot {
  document: PageDocument;
  revision: string | null;
  publishedRevision: string | null;
}

export interface PageStoreSaveOptions {
  expectedRevision?: string | null;
}

export interface PageStoreSaveResult {
  revision: string | null;
  publishedRevision: string | null;
}

export interface PageSummary {
  id: DocumentId;
  kind?: DocumentKind;
  savedAt?: string;
}

export interface PageStore {
  load(identity: string | DocumentIdentity): Promise<PageStoreSnapshot | null>;
  save(
    identity: string | DocumentIdentity,
    document: PageDocument,
    options?: PageStoreSaveOptions,
  ): Promise<PageStoreSaveResult>;
  list(): Promise<PageSummary[]>;
  remove(identity: string | DocumentIdentity): Promise<void>;
}

export interface ThemeColors {
  themePrimary: string;
  themeLighterAlt: string;
  themeLighter: string;
  themeLight: string;
  themeTertiary: string;
  themeSecondary: string;
  themeDarkAlt: string;
  themeDark: string;
  themeDarker: string;
  neutralLighterAlt: string;
  neutralLighter: string;
  neutralLight: string;
  neutralQuaternaryAlt: string;
  neutralQuaternary: string;
  neutralTertiaryAlt: string;
  neutralTertiary: string;
  neutralSecondaryAlt: string;
  neutralSecondary: string;
  neutralPrimaryAlt: string;
  neutralPrimary: string;
  neutralDark: string;
  black: string;
  white: string;
}

export interface MountEditorOptions {
  container: HTMLElement;
  pageId?: string;
  identity?: DocumentIdentity;
  storage?: PageStore;
  basePath?: string;
  routeBasePath?: string;
  assetBasePath?: string;
  navigate?: (href: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  uploadMedia?: (file: File) => Promise<string>;
  theme?: ThemeColors;
}

export interface EditorHandle {
  unmount(): void;
}

export declare function mountEditor(options: MountEditorOptions): EditorHandle;

export interface PageDocumentRendererProps {
  document: PageDocument;
  theme: ThemeColors;
  assetBasePath?: string;
  asLandmark?: boolean;
}

export declare function PageDocumentRenderer(props: PageDocumentRendererProps): import('react').ReactElement;
export declare const PAGE_SCHEMA_VERSION: number;
export declare function validatePageDocument(input: unknown):
  | { ok: true; document: PageDocument }
  | { ok: false; errors: string[] };
