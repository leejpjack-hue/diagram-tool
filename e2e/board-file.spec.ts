import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void }[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

test.describe('File open and save on this device', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
      delete host.showOpenFilePicker;
      delete host.showSaveFilePicker;
    });
  });

  test('File menu lists Open, Save, Save As, and Reload from disk', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await waitForEditor(page);

    await page.getByRole('button', { name: 'File' }).click();
    await expect(page.getByTestId('file-menu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save As…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload from disk' })).toBeDisabled();
  });

  test('invalid Open does not clobber the current board', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await expect(page.getByText('title: Untitled Architecture')).toBeVisible();

    const path = join(tmpdir(), `diagram-tool-invalid-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify({
      version: '3.0',
      kind: 'workspace',
      boards: [],
    }));

    await page.getByRole('button', { name: 'File' }).click();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Open…' }).click(),
    ]);
    await fileChooser.setFiles(path);

    await expect(page.getByText(/workspace backup/i)).toBeVisible();
    await expect(page.getByText('title: Untitled Architecture')).toBeVisible();

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled Architecture' })).toBeVisible();
  });
});
