import { mountEditor } from './editor';
import { readConfig } from './editor/config';
import { parseRoute } from './editor/routes';
import { DEFAULT_PAGE_ID } from './editor/store/types';
import './styles.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found.');
}

const { basePath } = readConfig();
const route = parseRoute(window.location.pathname, basePath);

switch (route.kind) {
  case 'home':
    mountEditor({ container, pageId: DEFAULT_PAGE_ID, basePath });
    break;
  case 'editor-index':
    mountEditor({ container, basePath });
    break;
  case 'editor':
    mountEditor({ container, pageId: route.pageId, basePath });
    break;
  case 'invalid-id':
  case 'not-found': {
    const main = document.createElement('main');
    main.className = 'editor-status';
    const heading = document.createElement('h1');
    heading.textContent = 'Page not found';
    const link = document.createElement('a');
    link.href = `${basePath}editor`;
    link.textContent = 'Go to the editor';
    main.append(heading, link);
    container.append(main);
    break;
  }
}
