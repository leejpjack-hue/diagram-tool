import { expect, test } from '@playwright/test';

test.describe('Durable local-first workspace', () => {
  test('keeps the last boards and a named checkpoint after reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('button', { name: /Blank Architecture/ }).click();
    await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();

    await page.getByRole('button', { name: /Blank Workflow/ }).click();
    await page.getByRole('button', { name: '⌂ Boards' }).click();

    await page.getByRole('button', { name: /Blank Sequence/ }).click();
    await page.getByRole('button', { name: '⌂ Boards' }).click();

    await expect(page.getByRole('heading', { name: 'Untitled architecture' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled sequence' })).toBeVisible();

    page.once('dialog', dialog => dialog.accept('Before train ride'));
    await page.getByRole('button', { name: 'Actions for Untitled architecture' }).click();
    await page.getByRole('button', { name: 'Version history' }).click();
    await page.getByRole('button', { name: 'Create checkpoint' }).click();
    await expect(page.getByText('Before train ride')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Untitled architecture' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled sequence' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions for Untitled architecture' }).click();
    await page.getByRole('button', { name: 'Version history' }).click();
    await expect(page.getByText('Before train ride')).toBeVisible();
    await expect(page.getByText('Named checkpoint')).toBeVisible();
  });

  test('shows the offline banner when navigator.onLine is false', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });

    await expect(page.getByTestId('offline-banner')).toHaveText('offline — changes on this device.');
  });
});
