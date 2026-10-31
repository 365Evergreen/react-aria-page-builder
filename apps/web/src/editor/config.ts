import { LocalStore } from './store/local-store';
import type { PageStore } from './store/types';

export type PageStoreKind = 'local' | 'cloudflare';

export interface EditorConfig {
  /** App base path with leading and trailing slash, e.g. `/react-aria-page-builder/`. */
  basePath: string;
  storeKind: PageStoreKind;
  /** Base URL of the Worker API (used by the cloudflare store, phase 3). */
  apiBase: string;
}

type Env = Record<string, string | boolean | undefined>;

export const normaliseBasePath = (value: string | undefined) => {
  let path = (value ?? '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  return path.endsWith('/') ? path : `${path}/`;
};

/**
 * Reads build-time settings. `BASE_URL` is set by Vite from `VITE_BASE_PATH`;
 * `VITE_PAGE_STORE` and `VITE_API_BASE` select and configure the page store.
 */
export const readConfig = (env: Env = import.meta.env): EditorConfig => {
  const kind = String(env.VITE_PAGE_STORE ?? 'local').trim().toLowerCase();
  if (kind !== 'local' && kind !== 'cloudflare') {
    throw new Error(`VITE_PAGE_STORE must be "local" or "cloudflare" (got "${kind}").`);
  }
  return {
    basePath: normaliseBasePath(typeof env.BASE_URL === 'string' ? env.BASE_URL : '/'),
    storeKind: kind,
    apiBase: String(env.VITE_API_BASE ?? '').trim().replace(/\/+$/, ''),
  };
};

export const createStore = (config: EditorConfig): PageStore => {
  switch (config.storeKind) {
    case 'local':
      return new LocalStore();
    case 'cloudflare':
      throw new Error(
        'VITE_PAGE_STORE=cloudflare is not available yet (planned for phase 3). Use "local".',
      );
  }
};
