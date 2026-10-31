import { BlockRegistry, type RegisteredBlockType } from '../page-builder/registry';
import { SAFE_IMAGE, SAFE_LINK } from '../page-builder/page-schema';
import type { BlockCategory } from '../page-builder/types';
import type { NodeProps, PageNode } from './model';

export const CONTAINER_TYPE = 'container';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'url'
  | 'imageUrl'
  | 'integer'
  | 'select'
  | 'boolean'
  | 'list';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** Where the value lives on the node; defaults to `data`. */
  scope?: 'data' | 'styles';
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  description?: string;
  /** For `list` fields: the fields of each item and how to name one. */
  itemFields?: FieldDef[];
  itemName?: string;
  newItem?: () => Record<string, unknown>;
}

export interface BuilderBlockDefinition {
  type: string;
  name: string;
  category: BlockCategory;
  description: string;
  canHaveChildren: boolean;
  fields: FieldDef[];
  defaults: () => NodeProps;
}

const newId = () => crypto.randomUUID();

export const validateField = (
  field: FieldDef,
  value: unknown,
  siblings: Record<string, unknown> = {},
): string | null => {
  if (field.kind === 'boolean' || field.kind === 'list') return null;
  const text = value === undefined || value === null ? '' : String(value);
  const trimmed = text.trim();

  if (field.key === 'alt' && siblings.decorative !== true && trimmed === '') {
    return 'Enter alt text, or mark the image as decorative.';
  }
  if (field.required && trimmed === '') return `${field.label} is required.`;
  if (field.maxLength && text.length > field.maxLength) {
    return `${field.label} must be ${field.maxLength} characters or fewer.`;
  }
  if (trimmed === '') return null;
  if (field.kind === 'url' && !SAFE_LINK.test(trimmed)) {
    return 'Use an http(s), mailto or tel URL, or a relative or # link.';
  }
  if (field.kind === 'imageUrl' && !SAFE_IMAGE.test(trimmed)) {
    return 'Use an http(s) URL, a relative path, or an image data URL.';
  }
  if (field.kind === 'integer') {
    const number = Number(trimmed);
    if (!Number.isInteger(number)) return `${field.label} must be a whole number.`;
    if (field.min !== undefined && number < field.min) {
      return `${field.label} must be at least ${field.min}.`;
    }
    if (field.max !== undefined && number > field.max) {
      return `${field.label} must be at most ${field.max}.`;
    }
  }
  return null;
};

const styleText = (key: string, label: string, description?: string): FieldDef => ({
  key,
  label,
  kind: 'text',
  scope: 'styles',
  maxLength: 40,
  description,
});

const FIELDS: Record<RegisteredBlockType, FieldDef[]> = {
  'hero-banner': [
    { key: 'eyebrow', label: 'Eyebrow', kind: 'text', maxLength: 80 },
    { key: 'title', label: 'Title', kind: 'text', maxLength: 200 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    { key: 'bgImage', label: 'Background image URL', kind: 'imageUrl' },
    { key: 'buttonText', label: 'Button text', kind: 'text', maxLength: 80 },
    { key: 'buttonUrl', label: 'Button URL', kind: 'url' },
    styleText('height', 'Height', 'A CSS length such as 55vh.'),
    {
      key: 'textAlign',
      label: 'Text alignment',
      kind: 'select',
      scope: 'styles',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Centre' },
        { value: 'right', label: 'Right' },
      ],
    },
  ],
  'grid-section': [
    { key: 'heading', label: 'Heading', kind: 'text', maxLength: 200 },
    { key: 'columns', label: 'Columns', kind: 'integer', min: 1, max: 4, required: true },
    {
      key: 'items',
      label: 'Cards',
      kind: 'list',
      itemName: 'card',
      itemFields: [
        { key: 'title', label: 'Title', kind: 'text', required: true, maxLength: 120 },
        { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
      ],
      newItem: () => ({ id: newId(), title: 'New card', description: '' }),
    },
    styleText('padding', 'Padding', 'A CSS length such as 4rem 1.5rem.'),
    styleText('gap', 'Gap', 'A CSS length such as 1.5rem.'),
  ],
  'media-gallery': [
    { key: 'heading', label: 'Heading', kind: 'text', maxLength: 200 },
    {
      key: 'layoutType',
      label: 'Layout',
      kind: 'select',
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'masonry', label: 'Masonry' },
      ],
    },
    {
      key: 'items',
      label: 'Images',
      kind: 'list',
      itemName: 'image',
      itemFields: [
        { key: 'src', label: 'Image URL', kind: 'imageUrl', required: true },
        { key: 'alt', label: 'Alt text', kind: 'text', maxLength: 300 },
        { key: 'decorative', label: 'Decorative image (no alt text)', kind: 'boolean' },
        { key: 'caption', label: 'Caption', kind: 'text', maxLength: 300 },
      ],
      newItem: () => ({ id: newId(), src: '', alt: '', decorative: false, caption: '' }),
    },
    styleText('gap', 'Gap', 'A CSS length such as 1rem.'),
  ],
};
const registryDefinitions: BuilderBlockDefinition[] = (
  Object.keys(BlockRegistry) as RegisteredBlockType[]
).map((type) => {
  const item = BlockRegistry[type];
  return {
    type,
    name: item.name,
    category: item.category,
    description: item.description,
    canHaveChildren: false,
    fields: FIELDS[type],
    defaults: () => {
      const { data, styles } = structuredClone(item.defaultConfig) as NodeProps;
      return { data, styles };
    },
  };
});

export const containerDefinition: BuilderBlockDefinition = {
  type: CONTAINER_TYPE,
  name: 'Container',
  category: 'layout',
  description: 'A group that holds other blocks.',
  canHaveChildren: true,
  fields: [{ key: 'label', label: 'Label', kind: 'text', maxLength: 80 }],
  defaults: () => ({ data: { label: 'Container' } }),
};

export const blockDefinitions: BuilderBlockDefinition[] = [
  containerDefinition,
  ...registryDefinitions,
];

export const getDefinition = (type: string) =>
  blockDefinitions.find((definition) => definition.type === type);

export const canHaveChildren = (type: string) =>
  getDefinition(type)?.canHaveChildren ?? false;

export const createNode = (
  type: string,
  id: string = crypto.randomUUID(),
): PageNode => ({
  id,
  type,
  props: getDefinition(type)?.defaults() ?? {},
  children: [],
});

export const getNodeLabel = (node: PageNode): string => {
  const data = node.props.data ?? {};
  const text = [data.title, data.heading, data.label].find(
    (value) => typeof value === 'string' && value.trim() !== '',
  );
  const name = getDefinition(node.type)?.name ?? node.type;
  return typeof text === 'string' ? `${name}: ${text}` : name;
};
