import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Hook-free path: open an architecture template through the Create dialog,
 * pick styles in the Style menu, reload, and export. No __setDiagramDsl.
 */
const TEMPLATE_TITLE = 'Multi-Tier Network Topology';

const TREATMENT = {
  clean: 'chip',
  line: 'line',
  bold: 'filled',
  blueprint: 'outline',
} as const;

const SHARED = `diagram: architecture
title: Shared style
direction: LR
edges: orthogonal
service Gateway {}
service Orders {}
edge Gateway -> Orders { label: "reads" step: 1 }
`;

async function dismissBoardCreatedToast(page: Page) {
  const created = page.getByTestId('toast-item').filter({ hasText: 'Board created' });
  await expect(created).toBeVisible();
  // Close this toast directly. A pointer left on the stack pauses an action
  // toast's timer, and a sibling toast must not keep the wait open.
  const close = created.getByRole('button', { name: '×' });
  await close.click({ timeout: 2000 }).catch(() => undefined);
  await expect(created).toHaveCount(0);
}

async function openArchitectureTemplate(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Create a board' });
  await createDialog.getByRole('button', { name: 'Templates', exact: true }).click();
  await createDialog.getByTestId('template-card-network-topology').click();
  await dismissBoardCreatedToast(page);
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await expect(page.locator('.react-flow__node-service').first()).toBeVisible();
  await expect(page.getByTestId('icon-style-picker')).toBeVisible();
}

async function chooseStyle(page: Page, id: keyof typeof TREATMENT) {
  await page.getByTestId('icon-style-picker').click();
  await page.getByTestId(`icon-style-option-${id}`).click();
  await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', id);
  await expect(page.locator('.react-flow__node-service [data-arch-kind="service"]').first()).toHaveAttribute('data-arch-style', id);
  await expect(page.locator('.react-flow__node-service [data-arch-kind="service"]').first()).toHaveAttribute('data-arch-treatment', TREATMENT[id]);
}

test.describe('Architecture icon styles', () => {
  test.describe.configure({ timeout: testTimeout(120_000) });

  test('picks each style on an architecture template, keeps it, and exports Blueprint', async ({ page }) => {
    await openArchitectureTemplate(page);
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'clean');
    await expect(page.locator('.react-flow__node-service [data-arch-treatment="chip"]').first()).toBeAttached();

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
      return boards.find(board => board.title === 'Multi-Tier Network Topology')?.iconStyle ?? '';
    }), { timeout: 8000 }).toBe('blueprint');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: TEMPLATE_TITLE }).first().click();
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'blueprint');
    await expect(page.locator('.react-flow__node-service [data-arch-treatment="outline"]').first()).toBeAttached();
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
  });

  // The Vite dev server has no Supabase client, so a share lookup never fires
  // and page.route cannot see it. Pin this test to the preview server (4173),
  // which Playwright's webServer already starts, matching the other share specs.
  // PW_BASE_URL can retarget it (for example at live) without hard-coding the path.
  test.describe('preview share', () => {
    test.use({ baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173' });

  test('shared architecture view renders Blueprint, step badges, and the walk highlight', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_diagram_by_share_token*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'shared-arch-style',
            title: 'Shared style',
            updated_at: '2026-10-18T09:00:00.000Z',
            payload: {
              version: '3.0',
              kind: 'board',
              exportedAt: '2026-10-18T09:00:00.000Z',
              watermark: null,
              requiresAccount: false,
              board: {
                title: 'Shared style',
                mode: 'architecture',
                iconStyle: 'blueprint',
                dslText: SHARED,
                source: { kind: 'dsl', text: SHARED },
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

    await page.goto('/app/?share=tok_arch_03');
    expect(new URL(page.url()).origin).toBe(new URL(process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173').origin);
    const banner = page.getByTestId('shared-readonly-banner');
    await expect(banner).toBeVisible();
    await expect(page.getByTestId('icon-style-picker')).toHaveCount(0);
    await expect(page.locator('[data-icon-style]')).toHaveAttribute('data-icon-style', 'blueprint');
    await expect(page.locator('.react-flow__node-service [data-arch-treatment="outline"]').first()).toBeAttached();

    const badge = page.getByTestId('architecture-step-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveCSS('background-color', 'rgb(224, 242, 254)');
    await expect(badge).toHaveCSS('color', 'rgb(11, 31, 58)');

    await banner.getByTestId('shared-walk-through').click();
    await expect(page.getByTestId('walk-through-caption')).toContainText('Gateway');
    await expect(page.getByTestId('rf__node-gateway')).toHaveCSS('box-shadow', /253,\s*230,\s*138/);
  });
  });
});
