import {
  PageBuilder,
  blocksToTree,
  loadPage,
  pageDefinitionSchema,
  type StoredPageDefinition,
} from '@page-builder/ui';
import pageData from './example-page.json';

const parsedPage = pageDefinitionSchema.safeParse(pageData);

export default function App() {
  if (!parsedPage.success) {
    return (
      <main className="app-error" role="alert">
        <h1>Page configuration is invalid</h1>
        <pre>{JSON.stringify(parsedPage.error.flatten(), null, 2)}</pre>
      </main>
    );
  }

  const page: StoredPageDefinition = parsedPage.data;
  const saved = loadPage();
  const initialTree = saved?.ok ? saved.tree : blocksToTree(page.blocks);

  return <PageBuilder initialTree={initialTree} theme={page.theme} autoSave />;
}
