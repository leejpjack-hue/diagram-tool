import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Hook-free path: import a real .mmd through the dashboard file picker, read
 * data-role on the headers, pick Blueprint in the Style menu, reload, and
 * export. No __setDiagramDsl.
 */
const SEQUENCE_MMD = `sequenceDiagram
title Role styles
%% role A ai
participant A
actor U as User
participant V as Vector DB
U->>A: ask
A->>V: write
`;

const SHARED = `sequenceDiagram
title Shared roles
%% role A ai
participant A
actor U as User
participant V as Vector DB
U->>A: ask
A->>V: write
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function dismissImportedToast(page: Page) {
  const imported = page.getByTestId('toast-item').filter({ hasText: 'Imported' });
  await expect(imported).toBeVisible();
  const close = imported.getByRole('button', { name: '×' });
  await close.click({ timeout: 2000 }).catch(() => undefined);
  await expect(imported).toHaveCount(0);
}

async function expectRoles(page: Page) {
  await expect(page.locator('[data-seq-participant="A"][data-role="ai"]')).toHaveCount(2);
  await expect(page.locator('[data-seq-participant="U"][data-role="human"]')).toHaveCount(2);
  await expect(page.locator('[data-seq-participant="V"][data-role="data"]')).toHaveCount(2);
  await expect(page.locator('.sequence-canvas').getByText('Vector DB', { exact: true }).first()).toBeVisible();
}

test.describe('Sequence participant roles and icon styles', () => {
  test.describe.configure({ timeout: testTimeout(120_000) });

  test('imports an mmd with a role comment, an actor, and a guessed data name, then keeps Blueprint across reload', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = join(tmpdir(), `diagram-tool-seq-roles-${Date.now()}.mmd`);
    writeFileSync(path, SEQUENCE_MMD);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path);
    await dismissImportedToast(page);
    await page.getByRole('heading', { name: 'Role styles' }).click();
    await waitForEditor(page);

    await expect(page.getByTestId('board-mode-status')).toHaveText('Sequence');
    await expect(page.getByTestId('icon-style-picker')).toBeVisible();
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'clean');
    await expectRoles(page);

    await page.getByTestId('icon-style-picker').click();
    await page.getByTestId('icon-style-option-blueprint').click();
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'blueprint');
    await expectRoles(page);
    await expect(page.locator('[data-seq-grid="blueprint"]')).toBeAttached();

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
      return boards.find(board => board.title === 'Role styles')?.iconStyle ?? '';
    }), { timeout: 8000 }).toBe('blueprint');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Role styles' }).click();
    await waitForEditor(page);
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'blueprint');
    await expectRoles(page);
    await expect(page.getByTestId('icon-style-picker')).toBeVisible();

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('button', { name: 'SVG Vector, free and portable' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/i);
    const saved = await download.path();
    let svg = readFileSync(saved!, 'utf8');
    if (svg.startsWith('data:')) {
      const comma = svg.indexOf(',');
      svg = decodeURIComponent(svg.slice(comma + 1));
    }
    expect(svg.toLowerCase()).toMatch(/0b1f3a|rgb\(11,\s*31,\s*58\)/);
    expect(svg.toLowerCase()).toMatch(/c4b5fd|rgb\(196,\s*181,\s*253\)/);
  });

  // The Vite dev server has no Supabase client, so a share lookup never fires
  // and page.route cannot see it. Pin this test to the preview server (4173).
  test.describe('preview share', () => {
    test.use({ baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173' });

    test('shared sequence view keeps roles, Blueprint, and the walk highlight', async ({ page }) => {
      await page.route('**/rest/v1/rpc/get_diagram_by_share_token*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'shared-seq-roles',
              title: 'Shared roles',
              updated_at: '2026-10-18T09:00:00.000Z',
              payload: {
                version: '3.0',
                kind: 'board',
                exportedAt: '2026-10-18T09:00:00.000Z',
                watermark: null,
                requiresAccount: false,
                board: {
                  title: 'Shared roles',
                  mode: 'sequence',
                  iconStyle: 'blueprint',
                  dslText: SHARED,
                  source: { kind: 'mermaid', text: SHARED },
                  nodes: [],
                  edges: [],
                  frames: [],
                  comments: [],
                  layout: { pins: {} },
                },
              },
            },
          ]),
        });
      });

      await page.goto('/app/?share=tok_seq_04');
      expect(new URL(page.url()).origin).toBe(new URL(process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173').origin);
      const banner = page.getByTestId('shared-readonly-banner');
      await expect(banner).toBeVisible();
      await expect(page.getByTestId('icon-style-picker')).toHaveCount(0);
      await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'blueprint');
      await expectRoles(page);

      const ask = page.locator('.sequence-canvas text').filter({ hasText: 'ask' }).first();
      await expect(ask).toHaveCSS('fill', 'rgb(224, 242, 254)');

      await banner.getByTestId('shared-walk-through').click();
      await expect(page.getByTestId('walk-through-caption')).toContainText('User');
      await expect(page.locator('[data-walk-current="true"]')).toHaveAttribute('opacity', '1');
      await expect(page.locator('[data-walk-index="1"]')).toHaveAttribute('opacity', '0.35');
      await expect(page.locator('[data-seq-participant="U"][data-walk-header="hot"]')).toHaveCount(2);
      await expect(page.locator('[data-seq-participant="V"][data-walk-header="dim"]').first()).toHaveAttribute('opacity', '0.35');
    });
  });
});
