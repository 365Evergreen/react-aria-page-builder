import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();

test.describe('editor routes', () => {
  test('/editor lists pages and is axe clean', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });

  test('/editor/:pageId creates, saves and reloads a page', async ({ page }) => {
    await page.goto('/editor/e2e-page');
    await expect(page.getByRole('treegrid', { name: 'Page canvas' })).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Page saved' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('treegrid', { name: 'Page canvas' })).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);

    await page.goto('/editor');
    await expect(page.getByText('e2e-page').first()).toBeVisible();
  });

  test('rich text block can be added and its editor is axe clean', async ({ page }) => {
    await page.goto('/editor/e2e-rich');
    const palette = page.getByRole('grid', { name: 'Available blocks' });
    await page.getByRole('searchbox', { name: 'Search blocks' }).fill('rich');
    await palette.getByRole('row').first().focus();
    await page.keyboard.press('Enter');
    const canvasRow = page.getByRole('treegrid', { name: 'Page canvas' }).getByRole('row', { name: /rich text/i }).first();
    await canvasRow.click();
    await expect(page.getByRole('heading', { name: /rich text|properties/i }).first()).toBeVisible();
    expect((await axe(page)).violations).toEqual([]);
  });

  test('invalid page ids show an error', async ({ page }) => {
    await page.goto('/editor/bad%20id');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
