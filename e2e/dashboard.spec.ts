import { expect, test } from '@playwright/test';

test.describe('Miro-style personal dashboard', () => {
  test('creates a board, organizes it, searches it, and restores it from Trash', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
    await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Untitled flow' })).toBeVisible();

    await page.getByRole('button', { name: 'New Space' }).click();
    await page.getByPlaceholder('New Space name').fill('Platform');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Actions for Untitled flow' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Platform workflow');
    await page.getByPlaceholder('architecture, payments, v2').fill('platform, demo');
    await page.locator('[role="dialog"] select').selectOption({ label: 'Platform' });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.getByPlaceholder('Search titles, descriptions, tags, and DSL').fill('demo');
    await expect(page.getByRole('heading', { name: 'Platform workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled flow' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Actions for Platform workflow' }).click();
    await page.getByRole('button', { name: 'Move to Trash' }).click();
    await page.getByRole('button', { name: 'Trash 1' }).click();
    await expect(page.getByRole('heading', { name: 'Platform workflow' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions for Platform workflow' }).click();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible();
  });

  test('keeps the mobile dashboard within the viewport and opens its navigation drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Templates', exact: true })).toBeVisible();
  });
});
