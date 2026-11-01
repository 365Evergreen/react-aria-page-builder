import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  CircleDot,
  CircleCheck,
  Filter,
  GitPullRequest,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Users,
} from 'lucide-react';
import { fetchRepositoryIssues, formatIssueDate, type GitHubIssue } from './github-issues';
import './issues.css';

type IssueState = 'all' | 'open' | 'closed';

interface IssueDashboardProps {
  owner: string;
  repository: string;
  basePath: string;
}

const initials = (name: string) =>
  name
    .split(/[-_ ]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const filterIssues = (
  issues: GitHubIssue[],
  query: string,
  state: IssueState,
  label: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  return issues.filter((issue) => {
    const matchesState = state === 'all' || issue.state === state;
    const matchesLabel = label === 'all' || issue.labels.some((item) => item.name === label);
    const matchesQuery =
      !normalizedQuery ||
      `${issue.title} ${issue.body ?? ''} #${issue.number} ${issue.author} ${issue.assignees.join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesState && matchesLabel && matchesQuery;
  });
};

export function IssueDashboard({ owner, repository, basePath }: IssueDashboardProps) {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<IssueState>('all');
  const [label, setLabel] = useState('all');
  const [view, setView] = useState<'list' | 'board'>('list');
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setIssues(await fetchRepositoryIssues(owner, repository, signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'An unexpected error occurred.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [owner, repository]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const labels = useMemo(
    () => [...new Set(issues.flatMap((issue) => issue.labels.map((item) => item.name)))].sort(),
    [issues],
  );
  const visibleIssues = useMemo(
    () => filterIssues(issues, query, state, label),
    [issues, label, query, state],
  );
  const openCount = issues.filter((issue) => issue.state === 'open').length;
  const closedCount = issues.length - openCount;

  const shownGroups = state === 'all'
    ? [
        { key: 'open' as const, title: 'Open', items: visibleIssues.filter((issue) => issue.state === 'open') },
        { key: 'closed' as const, title: 'Closed', items: visibleIssues.filter((issue) => issue.state === 'closed') },
      ]
    : [{ key: state, title: state === 'open' ? 'Open' : 'Closed', items: visibleIssues }];

  return (
    <main className="issues-app">
      <header className="issues-topbar">
        <a className="issues-brand" href={`${basePath}issues`} aria-label="Issue dashboard home">
          <span className="issues-brand-mark"><GitPullRequest size={17} /></span>
          <span>Repo<span className="issues-brand-accent">board</span></span>
        </a>
        <nav className="issues-topnav" aria-label="Main navigation">
          <a className="is-current" href={`${basePath}issues`}>Issues</a>
          <a href={`${basePath}editor`}>Page builder</a>
        </nav>
        <a
          className="issues-repo-link"
          href={`https://github.com/${owner}/${repository}`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="repo-avatar" aria-hidden="true">{initials(owner)}</span>
          <span>{owner}/{repository}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </header>

      <div className="issues-content">
        <section className="issues-heading" aria-labelledby="issues-title">
          <div>
            <p className="issues-eyebrow">REPOSITORY OVERVIEW</p>
            <h1 id="issues-title">Issues</h1>
            <p className="issues-description">
              Track conversations, prioritize work, and keep {repository} moving.
            </p>
          </div>
          <div className="issues-heading-actions">
            <button
              className="issues-button issues-button-subtle"
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'is-spinning' : undefined} />
              Refresh
            </button>
            <a
              className="issues-button issues-button-primary"
              href={`https://github.com/${owner}/${repository}/issues/new/choose`}
              target="_blank"
              rel="noreferrer"
            >
              <Plus size={16} />
              New issue
              <ArrowUpRight size={13} />
            </a>
          </div>
        </section>

        <section className="issues-stats" aria-label="Issue summary">
          <article className="issues-stat-card">
            <span className="issues-stat-icon open"><CircleDot size={17} /></span>
            <div><p>Open issues</p><strong>{loading && issues.length === 0 ? '—' : openCount}</strong></div>
            <span className="issues-stat-note">need attention</span>
          </article>
          <article className="issues-stat-card">
            <span className="issues-stat-icon closed"><CircleCheck size={17} /></span>
            <div><p>Closed issues</p><strong>{loading && issues.length === 0 ? '—' : closedCount}</strong></div>
            <span className="issues-stat-note">resolved</span>
          </article>
          <article className="issues-stat-card">
            <span className="issues-stat-icon labels"><Tag size={17} /></span>
            <div><p>Labels</p><strong>{labels.length}</strong></div>
            <span className="issues-stat-note">in use</span>
          </article>
          <article className="issues-stat-card">
            <span className="issues-stat-icon people"><Users size={17} /></span>
            <div><p>Contributors</p><strong>{new Set(issues.map((issue) => issue.author)).size}</strong></div>
            <span className="issues-stat-note">opened issues</span>
          </article>
        </section>

        <section className="issues-panel" aria-labelledby="issue-list-heading">
          <div className="issues-panel-heading">
            <div className="issues-panel-title">
              <h2 id="issue-list-heading">All issues</h2>
              <span className="issues-count">{visibleIssues.length}</span>
            </div>
            <div className="issues-view-toggle" role="group" aria-label="Issue layout">
              <button
                type="button"
                aria-pressed={view === 'list'}
                className={view === 'list' ? 'is-selected' : ''}
                onClick={() => setView('list')}
              >List</button>
              <button
                type="button"
                aria-pressed={view === 'board'}
                className={view === 'board' ? 'is-selected' : ''}
                onClick={() => setView('board')}
              >Board</button>
            </div>
          </div>
          <div className="issues-toolbar">
            <label className="issues-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search issues</span>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search issues..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <label className="issues-select">
              <Filter size={15} aria-hidden="true" />
              <span className="sr-only">Filter by state</span>
              <select value={state} onChange={(event) => setState(event.target.value as IssueState)}>
                <option value="all">All states</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="issues-select">
              <Tag size={15} aria-hidden="true" />
              <span className="sr-only">Filter by label</span>
              <select value={label} onChange={(event) => setLabel(event.target.value)}>
                <option value="all">All labels</option>
                {labels.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          {error ? (
            <div className="issues-message issues-error" role="alert">
              <strong>Could not load issues</strong>
              <p>{error}</p>
              <button className="issues-button issues-button-subtle" type="button" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          ) : loading && issues.length === 0 ? (
            <p className="issues-message" role="status">Loading repository issues…</p>
          ) : visibleIssues.length === 0 ? (
            <div className="issues-message">
              <CircleCheck size={23} />
              <strong>{issues.length === 0 ? 'No issues yet' : 'No issues match these filters'}</strong>
              <p>{issues.length === 0 ? 'This repository has no public issues to show.' : 'Try changing your search or filters.'}</p>
              {issues.length > 0 && (
                <button className="issues-text-button" type="button" onClick={() => { setQuery(''); setLabel('all'); setState('all'); }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : view === 'board' ? (
            <div className="issues-board">
              {shownGroups.map((group) => (
                <section className="issues-board-column" key={group.key} aria-label={`${group.title} issues`}>
                  <header>
                    {group.key === 'open' ? <CircleDot size={16} /> : <CircleCheck size={16} />}
                    <h3>{group.title}</h3>
                    <span>{group.items.length}</span>
                  </header>
                  {group.items.map((issue) => <IssueCard issue={issue} key={issue.id} />)}
                  {group.items.length === 0 && <p className="issues-column-empty">Nothing here yet</p>}
                </section>
              ))}
            </div>
          ) : (
            <div className="issues-list">
              {visibleIssues.map((issue) => <IssueRow issue={issue} key={issue.id} />)}
            </div>
          )}
          {loading && issues.length > 0 && <p className="issues-refresh-status" role="status">Refreshing issues…</p>}
        </section>

        <footer className="issues-footer">
          <span>Issue data is read from the public GitHub API.</span>
          <a href={`https://github.com/${owner}/${repository}/issues`} target="_blank" rel="noreferrer">
            Open in GitHub <ArrowUpRight size={12} />
          </a>
        </footer>
      </div>
    </main>
  );
}

function IssueRow({ issue }: { issue: GitHubIssue }) {
  return (
    <article className="issue-row">
      <span className={`issue-state-icon ${issue.state}`} aria-label={issue.state}>
        {issue.state === 'open' ? <CircleDot size={17} /> : <CircleCheck size={17} />}
      </span>
      <div className="issue-main">
        <a className="issue-title" href={issue.htmlUrl} target="_blank" rel="noreferrer">
          {issue.title}
          <ArrowUpRight size={12} aria-hidden="true" />
        </a>
        <div className="issue-meta">
          <span>#{issue.number}</span><span>·</span><span>{issue.author}</span><span>·</span>
          <span>{issue.state === 'open' ? 'opened' : 'closed'} {formatIssueDate(issue.createdAt)}</span>
        </div>
      </div>
      <div className="issue-labels">
        {issue.labels.slice(0, 3).map((item) => (
          <span className="issue-label" key={item.name} style={{ '--label-color': `#${item.color}` } as CSSProperties}>
            {item.name}
          </span>
        ))}
        {issue.labels.length > 3 && <span className="issue-label-more">+{issue.labels.length - 3}</span>}
      </div>
      <div className="issue-assignees" aria-label={issue.assignees.length ? `Assigned to ${issue.assignees.join(', ')}` : 'Unassigned'}>
        {issue.assignees.length
          ? issue.assignees.slice(0, 2).map((name) => <span className="issue-avatar" title={name} key={name}>{initials(name)}</span>)
          : <span className="issue-unassigned">Unassigned</span>}
      </div>
      <span className="issue-updated">Updated {formatIssueDate(issue.updatedAt)}</span>
    </article>
  );
}

function IssueCard({ issue }: { issue: GitHubIssue }) {
  return (
    <article className="issue-card">
      <div className="issue-card-top">
        <span className={`issue-state-icon ${issue.state}`} aria-label={issue.state}>
          {issue.state === 'open' ? <CircleDot size={16} /> : <CircleCheck size={16} />}
        </span>
        <span>#{issue.number}</span>
      </div>
      <a className="issue-card-title" href={issue.htmlUrl} target="_blank" rel="noreferrer">{issue.title}</a>
      {issue.labels.length > 0 && (
        <div className="issue-labels issue-card-labels">
          {issue.labels.slice(0, 2).map((item) => (
            <span className="issue-label" key={item.name} style={{ '--label-color': `#${item.color}` } as CSSProperties}>
              {item.name}
            </span>
          ))}
        </div>
      )}
      <footer>
        <span>{issue.author}</span>
        <span>{issue.assignees[0] ? initials(issue.assignees[0]) : '—'}</span>
      </footer>
    </article>
  );
}
