import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { PageBuilder } from '../PageBuilder';
import { createNode } from '../definitions';

const theme = new Proxy({}, { get: () => '#123456' }) as never;

const setup = () =>
  render(
    <PageBuilder
      theme={theme}
      initialTree={[
        createNode('hero-banner', 'a'),
        createNode('media-gallery', 'b'),
        createNode('container', 'c'),
      ]}
    />,
  );

const rows = () =>
  within(screen.getByRole('treegrid', { name: 'Page canvas' })).getAllByRole('row');
const labels = () => rows().map((r) => r.getAttribute('aria-label') ?? r.textContent);

describe('PageBuilder', () => {
  it('has no axe violations', async () => {
    const { container } = setup();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('has no axe violations with a selection and preview', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(rows()[0]);
    await user.click(screen.getByRole('button', { name: 'Show preview' }));
    expect((await axe(container)).violations).toEqual([]);
  });

  it('filters the palette by search', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search blocks' }), 'gallery');
    const list = screen.getByRole('grid', { name: 'Available blocks' });
    expect(within(list).getAllByRole('row')).toHaveLength(1);
    await user.clear(screen.getByRole('searchbox', { name: 'Search blocks' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search blocks' }), 'zzzz');
    expect(screen.getByText(/No blocks match/)).toBeInTheDocument();
  });

  it('inserts a block from the palette with Enter and announces it', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(rows()[0]);
    const option = screen.getByRole('row', { name: /Layout section/ });
    act(() => option.focus());
    await user.keyboard('{Enter}');
    expect(rows()).toHaveLength(4);
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(/added, position 2 of 4/);
  });

  it('inserts the focused block with Enter at the end when nothing is selected', async () => {
    const user = userEvent.setup();
    setup();
    const option = within(screen.getByRole('grid', { name: 'Available blocks' })).getByRole('row', { name: /Hero banner/ });
    act(() => option.focus());
    await user.keyboard('{Enter}');
    expect(rows()).toHaveLength(4);
  });

  it('navigates blocks with arrows, Home and End, selecting as it goes', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(rows()[0]);
    await user.keyboard('{ArrowDown}');
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(rows()[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves the selected block with Alt+Arrow and keeps focus on it', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(rows()[1]);
    const before = labels();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(labels()[0]).toBe(before[1]);
    expect(rows()[0]).toHaveFocus();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(/moved up, position 1 of 3/);
  });

  it('duplicates with Ctrl+D and deletes with Delete, then undoes', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(rows()[0]);
    await user.keyboard('{Control>}d{/Control}');
    expect(rows()).toHaveLength(4);
    expect(rows()[1]).toHaveFocus();
    await user.keyboard('{Delete}');
    expect(rows()).toHaveLength(3);
    expect(rows().some((r) => r === document.activeElement)).toBe(true);
    await user.keyboard('{Control>}z{/Control}');
    expect(rows()).toHaveLength(4);
  });

  it('edits properties and reflects them in the canvas', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(rows()[0]);
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Welcome');
    expect(rows()[0]).toHaveTextContent('Welcome');
  });

  it('shows toolbar actions disabled without a selection', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('reports dirty changes and undo while retaining dirty state after a failed save', async () => {
    const user = userEvent.setup();
    const dirtyChanges: boolean[] = [];
    render(
      <PageBuilder
        theme={theme}
        initialTree={[createNode('hero-banner', 'a')]}
        persistence={{
          save: async () => ({ ok: false, errors: ['save failed'] }),
          load: async () => null,
        }}
        onDirtyChange={(dirty) => dirtyChanges.push(dirty)}
      />,
    );
    await waitFor(() => expect(dirtyChanges.at(-1)).toBe(false));
    await user.click(rows()[0]);
    await user.keyboard('{Control>}d{/Control}');
    await waitFor(() => expect(dirtyChanges.at(-1)).toBe(true));
    await user.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(dirtyChanges.at(-1)).toBe(false));
    await user.click(rows()[0]);
    await user.keyboard('{Control>}d{/Control}');
    await waitFor(() => expect(dirtyChanges.at(-1)).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    expect(dirtyChanges.at(-1)).toBe(true);
  });

  it('clears initial dirty state only after a successful save', async () => {
    const user = userEvent.setup();
    const dirtyChanges: boolean[] = [];
    render(
      <PageBuilder
        theme={theme}
        initialTree={[createNode('hero-banner', 'a')]}
        initialDirty
        persistence={{
          save: async () => ({ ok: true }),
          load: async () => null,
        }}
        onDirtyChange={(dirty) => dirtyChanges.push(dirty)}
      />,
    );
    await waitFor(() => expect(dirtyChanges.at(-1)).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(dirtyChanges.at(-1)).toBe(false));
  });

  it('edits alt text and validates URLs in the gallery', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(rows()[1]);
    await user.click(screen.getByRole('button', { name: 'Add image' }));
    const url = screen.getByRole('textbox', { name: /Image URL/ });
    expect(url).toBeInvalid();
    await user.type(url, 'javascript:alert(1)');
    expect(url).toBeInvalid();
    expect(screen.getByText(/Use an http\(s\) URL/)).toBeInTheDocument();
    await user.clear(url);
    await user.type(url, 'https://example.com/a.png');
    expect(url).toBeValid();
    const alt = screen.getByRole('textbox', { name: /Alt text/ });
    expect(alt).toBeInvalid();
    await user.click(screen.getByRole('checkbox', { name: /Decorative/ }));
    expect(alt).toBeValid();
  });

  it('refuses to save invalid pages and saves valid ones', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    setup();
    await user.click(rows()[1]);
    await user.click(screen.getByRole('button', { name: 'Add image' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Cannot save yet/);
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(localStorage.getItem('react-aria-page-builder.page')).toContain('"format": "react-aria-page-builder"');
  });
});

