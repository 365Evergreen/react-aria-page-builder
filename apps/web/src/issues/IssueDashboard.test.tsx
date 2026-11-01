import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssueDashboard } from './IssueDashboard';

const response = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const issues = [
  {
    id: 1,
    number: 12,
    title: 'Add keyboard shortcuts',
    body: 'Support keyboard navigation in the editor.',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/12',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-03T00:00:00Z',
    labels: [{ name: 'enhancement', color: 'a2eeef' }],
    assignees: [{ login: 'octocat' }],
    user: { login: 'octocat' },
  },
  {
    id: 2,
    number: 13,
    title: 'Fix page preview',
    body: 'Preview currently clips content.',
    state: 'closed',
    html_url: 'https://github.com/owner/repo/issues/13',
    created_at: '2025-02-02T00:00:00Z',
    updated_at: '2025-02-03T00:00:00Z',
    labels: [{ name: 'bug', color: 'd73a4a' }],
    assignees: [],
    user: { login: 'hubot' },
  },
  {
    id: 3,
    number: 14,
    title: 'Pull request should not be listed',
    state: 'open',
    html_url: 'https://github.com/owner/repo/pull/14',
    created_at: '2025-03-02T00:00:00Z',
    updated_at: '2025-03-03T00:00:00Z',
    labels: [],
    assignees: [],
    user: { login: 'octocat' },
    pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/14' },
  },
];

describe('IssueDashboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads real issue-shaped data and filters the list by search and label', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(issues)));
    render(<IssueDashboard owner="owner" repository="repo" basePath="/" />);

    expect(await screen.findByRole('link', { name: /Add keyboard shortcuts/ })).toBeTruthy();
    expect(screen.queryByText('Pull request should not be listed')).toBeNull();
    expect(screen.getByText('Open issues').parentElement?.querySelector('strong')?.textContent).toBe('1');
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search issues' }));

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search issues' }), {
      target: { value: 'preview' },
    });
    expect(screen.getByRole('link', { name: /Fix page preview/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Add keyboard shortcuts/ })).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search issues' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by label' }), {
      target: { value: 'enhancement' },
    });
    expect(screen.getByRole('link', { name: /Add keyboard shortcuts/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Fix page preview/ })).toBeNull();
  });

  it('shows API errors and offers a retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetchMock);
    render(<IssueDashboard owner="owner" repository="repo" basePath="/" />);

    expect(await screen.findByText(/Repository not found/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No issues yet')).toBeTruthy();
  });

  it('shows filtered results in board view', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(issues)));
    render(<IssueDashboard owner="owner" repository="repo" basePath="/" />);

    await screen.findByRole('link', { name: /Add keyboard shortcuts/ });
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(within(screen.getByRole('region', { name: 'Open issues' })).getByText(/Add keyboard shortcuts/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Closed issues' })).getByText(/Fix page preview/)).toBeTruthy();
  });
});
