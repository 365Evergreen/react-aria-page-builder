import type { RegistryItem } from './types';
import type {
  GridSectionConfig,
  HeroBannerConfig,
  MediaGalleryConfig,
  PageBlockConfig,
} from './block-configs';
import { Gallery, HeroBanner, Section } from '../primitives';

type PageRegistryItem = RegistryItem<PageBlockConfig>;

export const BlockRegistry = {
  'grid-section': {
    type: 'grid-section',
    name: 'Layout section',
    category: 'layout',
    description: 'A responsive card section with configurable columns.',
    component: Section,
    version: 1,
    defaultConfig: {
      type: 'grid-section',
      styles: {
        padding: '4rem 1.5rem',
        gap: '1.5rem',
      },
      data: {
        heading: 'Section heading',
        columns: 3,
        items: [],
      },
    },
  } satisfies RegistryItem<GridSectionConfig>,

  'hero-banner': {
    type: 'hero-banner',
    name: 'Hero banner',
    category: 'design',
    description: 'A prominent banner with optional supporting copy and action.',
    component: HeroBanner,
    version: 1,
    defaultConfig: {
      type: 'hero-banner',
      styles: {
        height: '55vh',
        textAlign: 'center',
      },
      data: {
        eyebrow: '',
        title: 'New page',
        description: '',
        bgImage: '',
        buttonText: '',
        buttonUrl: '',
      },
    },
  } satisfies RegistryItem<HeroBannerConfig>,

  'media-gallery': {
    type: 'media-gallery',
    name: 'Media gallery',
    category: 'content',
    description: 'An accessible image collection with grid and masonry modes.',
    component: Gallery,
    version: 1,
    defaultConfig: {
      type: 'media-gallery',
      styles: {
        gap: '1rem',
      },
      data: {
        heading: 'Gallery',
        items: [],
        layoutType: 'grid',
      },
    },
  } satisfies RegistryItem<MediaGalleryConfig>,
} as const;

export type RegisteredBlockType = keyof typeof BlockRegistry;

export const isRegisteredBlockType = (
  type: string,
): type is RegisteredBlockType => type in BlockRegistry;

export const getRegistryByCategory = () =>
  Object.values(BlockRegistry).reduce<
    Partial<Record<PageRegistryItem['category'], PageRegistryItem[]>>
  >((groups, item) => {
    const currentItems = groups[item.category] ?? [];
    groups[item.category] = [...currentItems, item as PageRegistryItem];
    return groups;
  }, {});
