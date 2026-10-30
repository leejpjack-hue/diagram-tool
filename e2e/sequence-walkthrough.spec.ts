import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.describe.configure({ timeout: testTimeout(90_000) });

const SEQUENCE_MMD = `sequenceDiagram
title Sequence walk
autonumber
participant U as User
participant A as Agent
participant S as Search tool
U->>A: find flights
A->>S: search flights
alt Success
  S-->>A: results
  A-->>U: options
else No seats
  S-xA: none left
end
`;

const STEPS = [
  { index: '0', caption: '1 · User → Agent: find flights' },
  { index: '1', caption: '2 · Agent → Search tool: search flights' },
  { index: '2', caption: '3 · Search tool → Agent: results reply (inside ALT: Success)' },
  { index: '3', caption: '4 · Agent → User: options reply (inside ALT: Success)' },
  { index: '4', caption: '5 · Search tool → Agent: none left failed (inside ALT: No seats)' },
] as const;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function expectStep(page: Page, index: number) {
  const step = STEPS[index];
  await expect(page.getByTestId('walk-through-caption')).toHaveText(step.caption);
  const current = page.locator('[data-walk-current="true"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute('data-walk-index', step.index);
}

test('imported sequence walks each message, dims the other rows, and Esc exits', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  const path = join(tmpdir(), `diagram-tool-seq-walk-${Date.now()}.mmd`);
  writeFileSync(path, SEQUENCE_MMD);

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('dashboard-import').click(),
  ]);
  await fileChooser.setFiles(path);
  await expect(page.getByTestId('toast-item').filter({ hasText: 'Imported' })).toBeVisible();
  await expect(page.getByTestId('toast-item')).toHaveCount(0, { timeout: 10_000 });

  await page.getByRole('heading', { name: 'Sequence walk' }).click();
  await waitForEditor(page);
  await expect(page.getByText('find flights').first()).toBeVisible();
  await expect(page.getByTestId('walk-through')).toBeVisible();
  await expect(page.getByTestId('toast-item')).toHaveCount(0);

  await page.getByTestId('walk-through').click();
  await expectStep(page, 0);
  await expect(page.locator('[data-walk-index="1"]')).toHaveAttribute('opacity', '0.35');
  await expect(page.locator('[data-seq-participant="U"][data-walk-header="hot"]')).toHaveCount(2);
  await expect(page.locator('[data-seq-participant="S"][data-walk-header="dim"]').first()).toHaveAttribute('opacity', '0.35');

  for (let index = 1; index < STEPS.length; index += 1) {
    await page.getByTestId('walk-through-next').click();
    await expectStep(page, index);
  }

  await page.keyboard.press('ArrowLeft');
  await expectStep(page, 3);
  await page.keyboard.press('ArrowRight');
  await expectStep(page, 4);

  await expect(page.getByTestId('walk-through-copy-path')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
  await expect(page.locator('[data-walk-current="true"]')).toHaveCount(0);
  await expect(page.getByTestId('walk-through')).toBeVisible();
});

test('shared read-only sequence board can walk through', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_diagram_by_share_token*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'shared-seq-walk',
          title: 'Sequence walk',
          updated_at: '2026-10-18T09:00:00.000Z',
          payload: {
            version: '3.0',
            kind: 'board',
            exportedAt: '2026-10-18T09:00:00.000Z',
            watermark: null,
            requiresAccount: false,
            board: {
              title: 'Sequence walk',
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

  await page.goto(new URL('/app/?share=tok_seq_03', process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173').toString());
  const banner = page.getByTestId('shared-readonly-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Sequence walk');
  const walkBtn = banner.getByTestId('shared-walk-through');
  await expect(walkBtn).toBeVisible();
  await expect(page.getByTestId('toast-item')).toHaveCount(0);
  await walkBtn.click();
  await expectStep(page, 0);
  await page.getByTestId('walk-through-next').click();
  await expectStep(page, 1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('shared-save-local-copy')).toBeVisible();
});
