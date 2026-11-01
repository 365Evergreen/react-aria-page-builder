export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  labels: { name: string; color: string }[];
  assignees: string[];
  author: string;
  isPullRequest: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseIssue = (value: unknown): GitHubIssue => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    typeof value.number !== 'number' ||
    typeof value.title !== 'string' ||
    (value.state !== 'open' && value.state !== 'closed') ||
    typeof value.html_url !== 'string' ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new Error('GitHub returned an issue with an unexpected format.');
  }

  const labels = Array.isArray(value.labels)
    ? value.labels.flatMap((label) =>
        isRecord(label) && typeof label.name === 'string'
          ? [{ name: label.name, color: typeof label.color === 'string' ? label.color : '8c959f' }]
          : [],
      )
    : [];
  const assignees = Array.isArray(value.assignees)
    ? value.assignees.flatMap((assignee) =>
        isRecord(assignee) && typeof assignee.login === 'string' ? [assignee.login] : [],
      )
    : [];
  const user = isRecord(value.user) && typeof value.user.login === 'string'
    ? value.user.login
    : 'unknown';

  return {
    id: value.id,
    number: value.number,
    title: value.title,
    body: typeof value.body === 'string' ? value.body : null,
    state: value.state,
    htmlUrl: value.html_url,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    labels,
    assignees,
    author: user,
    isPullRequest: 'pull_request' in value,
  };
};

const nextPageUrl = (header: string | null): string | null => {
  if (!header) return null;
  const next = header.split(',').find((part) => part.includes('rel="next"'));
  const match = next?.match(/<([^>]+)>/);
  if (!match) return null;
  const url = new URL(match[1]);
  if (url.origin !== 'https://api.github.com' || !url.pathname.startsWith('/repos/')) {
    throw new Error('GitHub returned an unexpected pagination URL.');
  }
  return url.href;
};

export async function fetchRepositoryIssues(
  owner: string,
  repository: string,
  signal?: AbortSignal,
): Promise<GitHubIssue[]> {
  const issues: GitHubIssue[] = [];
  let url: string | null = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues?state=all&per_page=100`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal,
    });
    if (!response.ok) {
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API rate limit reached. Try again later.');
      }
      if (response.status === 404) {
        throw new Error('Repository not found or its issues are not publicly accessible.');
      }
      throw new Error(`Could not load GitHub issues (HTTP ${response.status}).`);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error('GitHub returned an unexpected issue list.');
    }
    issues.push(...payload.map(parseIssue).filter((issue) => !issue.isPullRequest));
    url = nextPageUrl(response.headers.get('link'));
  }

  return issues;
}

export const formatIssueDate = (date: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(date),
  );
