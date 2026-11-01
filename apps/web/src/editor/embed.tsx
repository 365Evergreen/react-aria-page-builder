import './embed.css';

export {
  mountEditor,
  type EditorHandle,
  type MountEditorOptions,
} from './mount';
export {
  PageDocumentRenderer,
  validatePageDocument,
  PAGE_SCHEMA_VERSION,
} from '@page-builder/ui';
export type {
  PageDocument,
  PageDocumentRendererProps,
} from '@page-builder/ui';
export type {
  DocumentId,
  DocumentIdentity,
  DocumentKind,
  PageStore,
  PageStoreIdentity,
  PageStoreSnapshot,
  PageStoreSaveOptions,
  PageStoreSaveResult,
  PageSummary,
} from './store/types';
