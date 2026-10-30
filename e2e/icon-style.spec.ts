import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STEPS = [
  'Human: ask the question',
  'Model: draft an answer',
  'Tool: search the docs',
  'Check: review the draft',
  'If approved then Send else Revise',
].join('\n');

const ROLES = ['human', 'model', 'tool', 'check'] as const;

const LEGACY_FLOW = `diagram: flow
title: Legacy Clean Flow
start Intake
Intake -> Review
end Review`;

async function openBlankWorkflow(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();
  await expect(page.getByTestId('icon-style-picker')).toBeVisible();
}

async function buildRoleBoard(page: Page) {
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(STEPS);
  await page.getByTestId('build-steps').click();
  await expect(page.getByTestId('toast-item').filter({ hasText: /Built/ })).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
}

async function chooseStyle(page: Page, id: 'clean' | 'line' | 'bold' | 'blueprint') {
  await page.getByTestId('icon-style-picker').click();
  await page.getByTestId(`icon-style-option-${id}`).click();
  await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', id);
  await expect(page.getByTestId('icon-style-picker')).toBeFocused();
  for (const role of ROLES) {
    await expect(page.locator(`[data-role-icon="${role}"]`).first()).toBeAttached();
  }
}

test.describe('Flow icon style switcher', () => {
  test.describe.configure({ timeout: testTimeout(120_000) });

  test('switches all four sets, keeps the choice across reload, and exports Bold', async ({ page }) => {
    await openBlankWorkflow(page);
    await buildRoleBoard(page);

    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'clean');
    for (const role of ROLES) {
      await expect(page.locator(`[data-role-chip="${role}"]`).first()).toBeAttached();
    }

    for (const id of ['clean', 'line', 'bold', 'blueprint'] as const) {
      await chooseStyle(page, id);
    }

    await expect.poll(async () => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('diagram-tool-workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const boards = await new Promise<Array<{ title?: string; iconStyle?: string }>>((resolve, reject) => {
        const request = db.transaction('boards', 'readonly').objectStore('boards').getAll();
        request.onsuccess = () => resolve(request.result as Array<{ title?: string; iconStyle?: string }>);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return boards.find(board => board.title === 'Untitled Workflow')?.iconStyle ?? '';
    }), { timeout: 8000 }).toBe('blueprint');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Untitled Workflow' }).first().click();
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'blueprint');
    await expect(page.getByTestId('icon-style-picker')).toBeVisible();

    const dir = mkdtempSync(join(tmpdir(), 'icon-style-'));
    const legacyPath = join(dir, 'legacy-flow.json');
    writeFileSync(legacyPath, JSON.stringify({
      version: '3.0',
      kind: 'board',
      exportedAt: '2026-08-01T00:00:00.000Z',
      board: {
        title: 'Legacy Clean Flow',
        mode: 'flow',
        dslText: LEGACY_FLOW,
        source: { kind: 'dsl', text: LEGACY_FLOW },
        nodes: [],
        edges: [],
        frames: [],
        comments: [],
      },
    }));

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await chooser.setFiles(legacyPath);
    await expect(page.getByText(/Imported “Legacy Clean Flow”/)).toBeVisible();
    await page.getByRole('heading', { name: 'Legacy Clean Flow' }).first().click();
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'clean');
    await expect(page.locator('[data-style-kind]')).toHaveCount(0);

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await page.getByRole('heading', { name: 'Untitled Workflow' }).first().click();
    await chooseStyle(page, 'bold');

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('button', { name: /Crisp image for docs/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });
});
