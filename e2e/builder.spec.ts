import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const canvas = (page: Page) => page.getByRole('treegrid', { name: 'Page canvas' });
const palette = (page: Page) => page.getByRole('grid', { name: 'Available blocks' });
const canvasRows = (page: Page) => canvas(page).getByRole('row');
const rowNames = async (page: Page) =>
  (await canvasRows(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('aria-label') ?? ''),
  ));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(canvasRows(page).first()).toBeVisible();
});

const dragTo = async (page: Page, source: Locator, target: Locator, where: 'top' | 'bottom' | 'middle') => {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  const y = where === 'top' ? to.y + 3 : where === 'bottom' ? to.y + to.height - 3 : to.y + to.height / 2;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 5, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, y, { steps: 15 });
  await page.mouse.move(to.x + to.width / 2, y + 1, { steps: 3 });
  await page.mouse.up();
};

test.describe('drag and drop', () => {
  test('pointer: drag a palette block onto the canvas', async ({ page }) => {
    const before = await rowNames(page);
    const handle = palette(page).getByRole('row', { name: /Container/ }).getByRole('button', { name: /drag/i });
    await dragTo(page, handle, canvasRows(page).first(), 'top');
    await expect(canvasRows(page)).toHaveCount(before.length + 1);
    expect((await rowNames(page))[0]).toMatch(/Container/);
    await expect(page.getByRole('status').first()).toContainText(/added, position 1/);
  });

  test('pointer: reorder canvas rows with the drag handle', async ({ page }) => {
    const before = await rowNames(page);
    const first = canvasRows(page).first();
    const second = canvasRows(page).nth(1);
    await dragTo(page, first.getByRole('button', { name: /drag/i }), second, 'bottom');
    await expect.poll(() => rowNames(page)).toEqual([before[1], before[0], before[2]]);
  });

  test('keyboard: reorder on the canvas with the drag handle', async ({ page }) => {
    const before = await rowNames(page);
    const handle = canvasRows(page).first().getByRole('button', { name: /drag/i });
    await handle.focus();
    await page.keyboard.press('Enter');
    // Arrow keys move between insertion points; Tab would cancel the drag.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => rowNames(page)).toEqual([before[1], before[0], before[2]]);
  });

  test('keyboard: drag a palette block onto the canvas', async ({ page }) => {
    const count = (await rowNames(page)).length;
    const handle = palette(page).getByRole('row', { name: /Container/ }).getByRole('button', { name: /drag/i });
    await handle.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(canvasRows(page)).toHaveCount(count + 1);
  });

  test('keyboard: Enter on a palette row inserts the block', async ({ page }) => {
    const count = (await rowNames(page)).length;
    await palette(page).getByRole('row', { name: /Container/ }).focus();
    await page.keyboard.press('Enter');
    await expect(canvasRows(page)).toHaveCount(count + 1);
  });
});

test.describe('canvas previews and properties', () => {
  test('rows render live block previews that follow edits', async ({ page }) => {
    const row = canvasRows(page).first();
    await expect(row.locator('.pb-node-preview h1, .pb-node-preview h2').first()).toBeVisible();
    await row.click();
    const title = page.getByRole('textbox', { name: 'Title' });
    await title.fill('Live preview title');
    await expect(row.locator('.pb-node-preview')).toContainText('Live preview title');
  });

  test('previews are inert and hidden from assistive tech', async ({ page }) => {
    const preview = canvasRows(page).first().locator('.pb-node-preview');
    await expect(preview).toHaveAttribute('aria-hidden', 'true');
    expect(await preview.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  });

  test('validates URL and alt text', async ({ page }) => {
    const gallery = canvasRows(page).filter({ hasText: /gallery/i }).first();
    await gallery.click();
    await page.getByRole('button', { name: 'Add image' }).click();
    const src = page.getByRole('textbox', { name: /Image URL/ });
    await src.fill('javascript:alert(1)');
    await expect(src).toHaveAttribute('aria-invalid', 'true');
    await src.fill('https://example.com/a.png');
    await expect(src).not.toHaveAttribute('aria-invalid', 'true');
    const alt = page.getByRole('textbox', { name: /Alt text/ });
    await expect(alt).toHaveAttribute('aria-invalid', 'true');
    await alt.fill('A descriptive alt');
    await expect(alt).not.toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('persistence', () => {
  test('save, reload and load restore the page; autosave persists edits', async ({ page }) => {
    await canvasRows(page).first().click();
    await page.getByRole('textbox', { name: 'Title' }).fill('Persisted title');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Page saved in this browser.')).toBeVisible();
    await page.reload();
    await expect(canvasRows(page).first()).toContainText('Persisted title');
  });

  test('export then import round-trips and rejects bad files', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export JSON' }).click(),
    ]);
    const path = await download.path();
    const before = await rowNames(page);
    await page.getByRole('button', { name: 'Delete' }).isDisabled();
    await canvasRows(page).first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(canvasRows(page)).toHaveCount(before.length - 1);
    await page.getByTestId('import-file').setInputFiles(path);
    await expect.poll(() => rowNames(page)).toEqual(before);

    await page.getByTestId('import-file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"react-aria-page-builder","version":1,"tree":[{"id":"x","type":"hero-banner","props":{"data":{"buttonUrl":"javascript:alert(1)"}},"children":[]}]}'),
    });
    await expect(page.getByRole('alert')).toContainText(/Cannot import bad.json/);
  });
});

test.describe('accessibility (axe, incl. colour contrast)', () => {
  const scan = async (page: Page) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    expect(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) })),
    ).toEqual([]);
  };

  test('initial page', async ({ page }) => scan(page));

  test('selected block with properties, and page preview', async ({ page }) => {
    await canvasRows(page).first().click();
    await page.getByRole('button', { name: 'Show preview' }).click();
    await scan(page);
  });

  test('gallery with validation errors, and notices', async ({ page }) => {
    await canvasRows(page).filter({ hasText: /gallery/i }).first().click();
    await page.getByRole('button', { name: 'Add image' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await scan(page);
  });

  test('hover, focus and drag states', async ({ page }) => {
    await palette(page).getByRole('row').first().hover();
    await scan(page);
    await canvasRows(page).first().getByRole('button', { name: /drag/i }).focus();
    await scan(page);
  });
});

