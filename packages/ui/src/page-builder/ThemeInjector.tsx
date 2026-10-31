import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { ThemeColors } from './types';

interface ThemeInjectorProps {
  theme: ThemeColors;
  children: ReactNode;
}

type CSSVariableProperties = CSSProperties & Record<`--${string}`, string>;

const toCssVariableName = (key: string): `--${string}` => {
  const kebabCase = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  return `--${kebabCase.toLowerCase()}`;
};

export const ThemeInjector = ({ theme, children }: ThemeInjectorProps) => {
  const inlineVariables = useMemo<CSSVariableProperties>(
    () =>
      Object.entries(theme).reduce<CSSVariableProperties>((variables, [key, value]) => {
        variables[toCssVariableName(key)] = value;
        return variables;
      }, {} as CSSVariableProperties),
    [theme],
  );

  return (
    <div
      className="page-builder-canvas-root"
      style={inlineVariables}
      data-theme-scope="page-builder"
    >
      {children}
    </div>
  );
};
