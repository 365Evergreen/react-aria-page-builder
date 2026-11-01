export { mountEditor, type EditorHandle, type MountEditorOptions } from './mount';
export { Editor, type EditorProps } from './Editor/Editor';
export { EditorIndex } from './EditorIndex/EditorIndex';
export { LocalStore, type LocalStoreOptions } from './store/local-store';
export {
  DEFAULT_PAGE_ID,
  PageStoreError,
  isValidPageId,
  type PageStore,
  type PageSummary,
} from './store/types';
export { createStore, readConfig, type EditorConfig, type PageStoreKind } from './config';
export { editorHref, parseRoute, type Route } from './routes';
