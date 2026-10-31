import type { PostBodyData } from './post-body';
import type { RichTextDoc } from './rich-text';
import type { BaseBlockConfig } from './types';

export interface GridItem {
  id: string;
  title: string;
  description?: string;
}

export interface GridSectionData {
  heading?: string;
  columns: number;
  items: GridItem[];
}

export interface GridSectionStyles {
  padding?: string;
  gap?: string;
}

export type GridSectionConfig = BaseBlockConfig<
  GridSectionData,
  GridSectionStyles
> & {
  type: 'grid-section';
};

export interface HeroBannerData {
  eyebrow?: string;
  title?: string;
  description?: string;
  bgImage?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface HeroBannerStyles {
  height?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export type HeroBannerConfig = BaseBlockConfig<
  HeroBannerData,
  HeroBannerStyles
> & {
  type: 'hero-banner';
};

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  decorative?: boolean;
  caption?: string;
}

export interface MediaGalleryData {
  heading?: string;
  items: GalleryItem[];
  layoutType: 'grid' | 'masonry';
}

export interface MediaGalleryStyles {
  gap?: string;
}

export type MediaGalleryConfig = BaseBlockConfig<
  MediaGalleryData,
  MediaGalleryStyles
> & {
  type: 'media-gallery';
};

export interface RichTextData {
  content: RichTextDoc;
}

export interface TextBlockStyles {
  maxWidth?: string;
}

export type RichTextBlockConfig = BaseBlockConfig<
  RichTextData,
  TextBlockStyles
> & {
  type: 'rich-text';
};

export type PostBodyConfig = BaseBlockConfig<PostBodyData, TextBlockStyles> & {
  type: 'post-body';
};

export type PageBlockConfig =
  | GridSectionConfig
  | HeroBannerConfig
  | MediaGalleryConfig
  | RichTextBlockConfig
  | PostBodyConfig;
