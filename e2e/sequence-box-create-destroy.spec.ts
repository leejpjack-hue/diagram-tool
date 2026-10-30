import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Hook-free path: import a real .mmd through the dashboard file picker.
 * No __setDiagramDsl. Persistence is read from IndexedDB, not the
 * diagram-tool-pending-board-writes localStorage mirror.
 */
const SEQUENCE_MMD = `sequenceDiagram
title Lifecycle
box Clients
participant U as User
participant B as Browser
end
U->>B: open
create participant W as Worker
B->>W: start job
W-->>B: done
destroy W
B->>U: closed
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

async function waitForSavedLifecycle(page: Page) {
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('diagram-tool-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const boards = await new Promise<Array<{ title?: string; dslText?: string }>>((resolve, reject) => {
      const request = db.transaction('boards', 'readonly').objectStore('boards').getAll();
      request.onsuccess = () => resolve(request.result as Array<{ title?: string; dslText?: string }>);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const board = boards.find(item => item.title === 'Lifecycle');
    return Boolean(board?.dslText?.includes('box Clients') && board.dslText.includes('destroy W'));
  }), { timeout: 8000 }).toBe(true);
}

async function expectLifecycle(page: Page) {
  await expect(page.getByTestId('board-mode-status')).toHaveText('Sequence');
  const box = page.getByTestId('seq-box');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Clients');
  await expect(page.locator('[data-seq-participant="U"]')).toHaveCount(2);
  await expect(page.locator('[data-seq-participant="W"]')).toHaveCount(1);
  await expect(page.locator('[data-seq-participant="W"]').first()).toContainText('Worker');
  await expect(page.getByTestId('seq-destroy')).toBeVisible();
  await expect(page.getByText('start job').first()).toBeVisible();
}

function decodeDownload(saved: string): string {
  let text = readFileSync(saved, 'utf8');
  if (text.startsWith('data:')) {
    const comma = text.indexOf(',');
    text = decodeURIComponent(text.slice(comma + 1));
  }
  return text;
}

test.describe('Sequence box groups, create, and destroy', () => {
  test.describe.configure({ timeout: testTimeout(120_000) });

  test('imports a labelled box, create, and destroy, and keeps them after reload', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = join(tmpdir(), `diagram-tool-seq-lifecycle-${Date.now()}.mmd`);
    writeFileSync(path, SEQUENCE_MMD);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path);
    await dismissImportedToast(page);
    await waitForSavedLifecycle(page);
    await page.getByRole('heading', { name: 'Lifecycle' }).click();
    await waitForEditor(page);
    await expectLifecycle(page);

    await page.getByTestId('walk-through').click();
    await expect(page.getByTestId('walk-through-caption')).toContainText('User → Browser: open');
    await expect(page.getByTestId('walk-through-caption')).not.toContainText('create');
    await page.getByTestId('walk-through-exit').click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Lifecycle' }).click();
    await waitForEditor(page);
    await expectLifecycle(page);

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('button', { name: 'SVG Vector, free and portable' }).click();
    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const svg = await svgDownload;
    expect(svg.suggestedFilename()).toMatch(/\.svg$/i);
    const svgPath = await svg.path();
    const svgText = decodeDownload(svgPath!);
    expect(svgText).toContain('Clients');
    expect(svgText).toContain('Worker');
    expect(svgText).toContain('seq-destroy');
    expect(svgText).toContain('seq-box');

    await page.getByRole('button', { name: 'PNG Crisp image for docs and wikis' }).click();
    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const png = await pngDownload;
    expect(png.suggestedFilename()).toMatch(/\.png$/i);
    const pngPath = await png.path();
    const pngBytes = readFileSync(pngPath!);
    expect(pngBytes.subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});

test.describe('Shared sequence box, create, and destroy', () => {
  test.describe.configure({ timeout: testTimeout(120_000) });
  test.use({ baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173' });

  test('shared read-only view shows the box band, create header, and destroy marker', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_diagram_by_share_token*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'shared-seq-lifecycle',
            title: 'Lifecycle',
            updated_at: '2026-10-20T01:00:00.000Z',
            payload: {
              version: '3.0',
              kind: 'board',
              exportedAt: '2026-10-20T01:00:00.000Z',
              watermark: null,
              requiresAccount: false,
              board: {
                title: 'Lifecycle',
                mode: 'sequence',
                dslText: SEQUENCE_MMD,
                source: { kind: 'mermaid', text: SEQUENCE_MMD },
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

    await page.goto('/app/?share=tok_seq_05');
    expect(new URL(page.url()).origin).toBe(new URL(process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173').origin);
    await expect(page.getByTestId('shared-readonly-banner')).toBeVisible();
    await expectLifecycle(page);
    await page.getByTestId('shared-walk-through').click();
    await expect(page.getByTestId('walk-through-caption')).toContainText('User → Browser: open');
  });
});
