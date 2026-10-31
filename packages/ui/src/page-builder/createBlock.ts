import type { PageBlockConfig } from './block-configs';
import { BlockRegistry, type RegisteredBlockType } from './registry';

export const createBlock = (type: RegisteredBlockType): PageBlockConfig => {
  const definition = BlockRegistry[type];

  return {
    ...structuredClone(definition.defaultConfig),
    id: crypto.randomUUID(),
  } as PageBlockConfig;
};
