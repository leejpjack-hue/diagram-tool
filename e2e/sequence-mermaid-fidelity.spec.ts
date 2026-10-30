import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SEQUENCE_MMD = `sequenceDiagram
title Checkout
autonumber
participant U as User
participant A as API
U->>+A: Place order
A-)A: Reserve stock
A--xU: Card declined
A-->>-U: Try again
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function expectFidelity(page: Page) {
  const numbers = page.getByTestId('seq-number');
  await expect(numbers).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    await expect(numbers.nth(i)).toBeVisible();
    await expect(numbers.nth(i)).toHaveText(String(i + 1));
  }
  await expect(page.getByTestId('seq-activation').first()).toBeVisible();
  await expect(page.locator('[data-arrow="async"]').first()).toBeVisible();
  await expect(page.locator('[data-arrow="lost"]').first()).toBeVisible();
  await expect(page.getByTestId('board-mode-status')).toHaveText('Sequence');
  await expect(page.getByText('Reserve stock').first()).toBeVisible();
}

test.describe('Sequence Mermaid fidelity', () => {
  test.describe.configure({ timeout: testTimeout(60_000) });

  test('imports autonumber, activation, async and lost arrows, and keeps them after reload', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = join(tmpdir(), `diagram-tool-seq-fidelity-${Date.now()}.mmd`);
    writeFileSync(path, SEQUENCE_MMD);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path);
    await expect(page.getByText(/Imported “Checkout”/)).toBeVisible();
    await page.getByRole('heading', { name: 'Checkout' }).click();
    await waitForEditor(page);
    await expectFidelity(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Checkout' }).click();
    await waitForEditor(page);
    await expectFidelity(page);
  });
});
