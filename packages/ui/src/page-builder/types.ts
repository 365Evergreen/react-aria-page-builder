// packages/ui/src/page-builder/types.ts
import type { ComponentType, CSSProperties } from 'react';

export type BlockCategory =
  | 'layout'
  | 'content'
  | 'design'
  | 'advanced';

export interface BaseBlockConfig<
  TData extends object = object,
  TStyles extends CSSProperties = CSSProperties,
> {
  id: string;
  type: string;
  styles?: TStyles;
  data?: TData;
}

export interface BlockComponentProps<
  TConfig extends BaseBlockConfig<object, CSSProperties> =
    BaseBlockConfig<object, CSSProperties>,
> {
  config: TConfig;
}

export interface RegistryItem<
  TConfig extends BaseBlockConfig<object, CSSProperties> =
    BaseBlockConfig<object, CSSProperties>,
> {
  type: TConfig['type'];
  name: string;
  category: BlockCategory;
  description: string;
  component: ComponentType<BlockComponentProps<TConfig>>;
  defaultConfig: Omit<TConfig, 'id'>;
  version: number;
  isLazy?: boolean;
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
