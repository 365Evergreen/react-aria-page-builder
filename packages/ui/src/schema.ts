export {
  PAGE_SCHEMA_VERSION,
  validatePageDocument,
  type PageDocumentValidation,
} from './page-builder/document-schema';
export { richTextSchema, validateRichText, type RichTextDoc, type RichTextBlock } from './page-builder/rich-text';
export { pageDefinitionSchema } from './page-builder/page-schema';
export type { PageDocument } from './builder/persistence';
