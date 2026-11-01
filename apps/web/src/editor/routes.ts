import { isValidPageId } from './store/types';

export type Route =
  | { kind: 'home' }
  | { kind: 'editor-index' }
  | { kind: 'editor'; pageId: string }
  | { kind: 'invalid-id'; id: string }
  | { kind: 'not-found' };

/** Resolves a pathname relative to the app base path (works on GitHub Pages sub-paths). */
export const parseRoute = (pathname: string, basePath: string): Route => {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const normalised = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (!normalised.startsWith(base)) return { kind: 'not-found' };

  const segments = normalised
    .slice(base.length)
    .split('/')
    .filter((part) => part !== '')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'index.html')) {
    return { kind: 'home' };
  }
  if (segments[0] !== 'editor') return { kind: 'not-found' };
  if (segments.length === 1) return { kind: 'editor-index' };
  if (segments.length > 2) return { kind: 'not-found' };
  return isValidPageId(segments[1])
    ? { kind: 'editor', pageId: segments[1] }
    : { kind: 'invalid-id', id: segments[1] };
};

export const editorHref = (basePath: string, pageId?: string) => {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return pageId ? `${base}editor/${encodeURIComponent(pageId)}` : `${base}editor`;
};
