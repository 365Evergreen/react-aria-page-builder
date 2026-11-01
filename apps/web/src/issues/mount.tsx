import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { IssueDashboard } from './IssueDashboard';

interface MountIssueDashboardOptions {
  container: HTMLElement;
  basePath: string;
}

export function mountIssueDashboard({ container, basePath }: MountIssueDashboardOptions) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <IssueDashboard
        owner={import.meta.env.VITE_GITHUB_OWNER ?? '365Evergreen'}
        repository={import.meta.env.VITE_GITHUB_REPO ?? 'react-aria-page-builder'}
        basePath={basePath}
      />
    </StrictMode>,
  );
  return { unmount: () => root.unmount() };
}
