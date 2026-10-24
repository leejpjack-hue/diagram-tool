import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Hook-free path: dashboard Import opens a real Mermaid gantt .mmd through
 * the file picker. No __setDiagramDsl.
 */
const GANTT_MMD = `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
Design :a1, 2026-08-01, 4d
Implement :after a1, 5d
`;

const UNSUPPORTED_MMD = `erDiagram
  CUSTOMER ||--o{ ORDER : places
`;

const ARCH_BETA_MMD = `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
`;

function fixturePath(label: string): string {
  return join(tmpdir(), `diagram-tool-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.mmd`);
}

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function closeToast(page: Page, text: string) {
  const toast = page.getByTestId('toast-item').filter({ hasText: text });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: '×' }).click();
  await expect(toast).toHaveCount(0);
}

function bar(page: Page, name: string): Locator {
  return page.locator(`[data-testid^="gantt-task-bar"][data-task-name="${name}"]`);
}

test.describe('Dashboard import of Mermaid gantt .mmd', () => {
  test.describe.configure({ timeout: 60_000 });

  test('imports a gantt .mmd from the dashboard and opens Gantt mode with bars and a dependency', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const path = fixturePath('gantt-mmd');
    writeFileSync(path, GANTT_MMD);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path);

    await closeToast(page, 'Imported “Sprint Plan”');
    await expect(page.getByRole('heading', { name: 'Sprint Plan' })).toBeVisible();
    await expect(page.getByTestId('board-mode-tag').filter({ hasText: 'Gantt' })).toBeVisible();

    await page.getByRole('heading', { name: 'Sprint Plan' }).click();
    await waitForEditor(page);

    await expect(page.getByTestId('board-mode-status')).toHaveText(/gantt mode/i);
    await expect(page.locator('footer.app-footer')).toContainText('Gantt Mode');
    await expect(page.getByRole('button', { name: 'Gantt', exact: true })).toHaveClass(/active/);
    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await expect(bar(page, 'Design')).toBeVisible();
    await expect(bar(page, 'Implement')).toBeVisible();
    await expect(page.locator('[data-testid^="gantt-task-bar"]')).toHaveCount(2);
    await expect(page.getByTestId('gantt-dependency-line')).toHaveCount(1);
    await expect(page.locator('[data-testid^="gantt-task-row"][data-task-name="Implement"]')).toHaveAttribute('data-start', '2026-08-06');
    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);
  });

  test('shows a toast naming an unsupported Mermaid kind', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const path = fixturePath('unsupported-mmd');
    writeFileSync(path, UNSUPPORTED_MMD);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path);

    const toast = page.getByTestId('toast-item').filter({ hasText: "Mermaid erDiagram isn't supported yet." });
    await expect(toast).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByText('No boards here yet')).toBeVisible();
    await toast.getByRole('button', { name: '×' }).click();
    await expect(toast).toHaveCount(0);

    const archBetaPath = fixturePath('arch-beta-mmd');
    writeFileSync(archBetaPath, ARCH_BETA_MMD);

    const [archBetaChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await archBetaChooser.setFiles(archBetaPath);

    const archToast = page.getByTestId('toast-item').filter({ hasText: "Mermaid architecture-beta isn't supported yet." });
    await expect(archToast).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByText('No boards here yet')).toBeVisible();
    await archToast.getByRole('button', { name: '×' }).click();
    await expect(archToast).toHaveCount(0);
  });
});
