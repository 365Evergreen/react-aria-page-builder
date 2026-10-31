import { BlockRegistry, type RegisteredBlockType } from '../page-builder/registry';
import type { BlockCategory } from '../page-builder/types';
import type { NodeProps, PageNode } from './model';

export const CONTAINER_TYPE = 'container';

export interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
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

const FIELDS: Record<RegisteredBlockType, FieldDef[]> = {
  'hero-banner': [
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description', multiline: true },
  ],
  'grid-section': [{ key: 'heading', label: 'Heading' }],
  'media-gallery': [{ key: 'heading', label: 'Heading' }],
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
  fields: [{ key: 'label', label: 'Label' }],
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
