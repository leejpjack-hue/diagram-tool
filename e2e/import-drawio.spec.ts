import { expect, test, type Page } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'two-boxes.drawio');

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

test.describe('draw.io dashboard import', () => {
  test.describe.configure({ timeout: 60_000 });

  test('imports a 2-box draw.io file as an editable flow board', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(FIXTURE);

    await expect(page.getByText(/Imported “Two Boxes”/)).toBeVisible();
    const report = page.getByTestId('import-report');
    if (await report.isVisible()) {
      await expect(page.getByTestId('import-mapped')).toContainText(/mapped/);
      if (await page.getByTestId('import-skipped').count()) {
        await expect(page.getByTestId('import-skipped').first()).toBeVisible();
      }
      await page.getByRole('button', { name: 'Done' }).click();
    }

    await expect(page.getByRole('heading', { name: 'Two Boxes' })).toBeVisible();
    await page.getByRole('heading', { name: 'Two Boxes' }).click();
    await waitForEditor(page);
    await expect(page.getByTestId('rf__node-intake')).toBeVisible();
    await expect(page.getByTestId('rf__node-review')).toBeVisible();
    await expect(page.getByText(/diagram:\s*flow/).first()).toBeVisible();
  });
});
