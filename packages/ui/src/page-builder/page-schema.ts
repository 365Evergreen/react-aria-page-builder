import { z } from 'zod';

const themeSchema = z.object({
  themePrimary: z.string(),
  themeLighterAlt: z.string(),
  themeLighter: z.string(),
  themeLight: z.string(),
  themeTertiary: z.string(),
  themeSecondary: z.string(),
  themeDarkAlt: z.string(),
  themeDark: z.string(),
  themeDarker: z.string(),
  neutralLighterAlt: z.string(),
  neutralLighter: z.string(),
  neutralLight: z.string(),
  neutralQuaternaryAlt: z.string(),
  neutralQuaternary: z.string(),
  neutralTertiaryAlt: z.string(),
  neutralTertiary: z.string(),
  neutralSecondaryAlt: z.string(),
  neutralSecondary: z.string(),
  neutralPrimaryAlt: z.string(),
  neutralPrimary: z.string(),
  neutralDark: z.string(),
  black: z.string(),
  white: z.string(),
});

const gridSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal('grid-section'),
  styles: z
    .object({
      padding: z.string().optional(),
      gap: z.string().optional(),
    })
    .optional(),
  data: z.object({
    heading: z.string().max(200).optional(),
    columns: z.number().int().min(1).max(4),
    items: z.array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
      }),
    ),
  }),
});

const heroBannerSchema = z.object({
  id: z.string().min(1),
  type: z.literal('hero-banner'),
  styles: z
    .object({
      height: z.string().optional(),
      textAlign: z.enum(['left', 'center', 'right']).optional(),
    })
    .optional(),
  data: z.object({
    eyebrow: z.string().max(80).optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    bgImage: z.string().optional(),
    buttonText: z.string().max(80).optional(),
    buttonUrl: z.string().optional(),
  }),
});

const mediaGallerySchema = z.object({
  id: z.string().min(1),
  type: z.literal('media-gallery'),
  styles: z
    .object({
      gap: z.string().optional(),
    })
    .optional(),
  data: z.object({
    heading: z.string().max(200).optional(),
    layoutType: z.enum(['grid', 'masonry']),
    items: z.array(
      z.object({
        id: z.string().min(1),
        src: z.string().min(1),
        alt: z.string(),
        caption: z.string().max(300).optional(),
      }),
    ),
  }),
});

export const pageLayoutSchema = z.array(
  z.discriminatedUnion('type', [
    gridSectionSchema,
    heroBannerSchema,
    mediaGallerySchema,
  ]),
);

export const pageDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  theme: themeSchema,
  blocks: pageLayoutSchema,
});

export type StoredPageDefinition = z.infer<typeof pageDefinitionSchema>;
