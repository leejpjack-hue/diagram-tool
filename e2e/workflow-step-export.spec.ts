import { testTimeout } from './testTimeout';
import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Local step-through export: typed flow and sequence boards save the current
// view with the existing PNG / SVG / PDF exporters. No account, no cloud.
test.describe.configure({ timeout: testTimeout(180_000) });

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

function decodeDownload(saved: string): string {
  let text = readFileSync(saved, 'utf8');
  if (text.startsWith('data:')) {
    const comma = text.indexOf(',');
    text = decodeURIComponent(text.slice(comma + 1));
  }
  return text;
}

async function exportStep(page: Page, format: 'png' | 'svg' | 'pdf', step: number): Promise<Download> {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: `Export step as ${format.toUpperCase()}` }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(new RegExp(`-step-${step}-\\d{4}-\\d{2}-\\d{2}\\.${format}$`, 'i'));
  return download;
}

test('typed flow walks node by node and exports the current step as PNG, SVG, and PDF', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill('Ask a question\nthen Draft an answer\nthen Send the reply');
  await page.getByTestId('build-steps').click();
  const built = page.getByTestId('toast-item').filter({ hasText: 'Built 3 steps' });
  await expect(built).toBeVisible();
  const walkFromToast = built.getByTestId('toast-action');
  await walkFromToast.focus();
  await expect(page.getByTestId('toast-item').filter({ hasText: 'Board created' })).toHaveCount(0);
  await walkFromToast.click();

  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 1 of 3');
  await expect(page.getByTestId('walk-through-caption')).toContainText('Ask a question');
  await page.getByTestId('walk-through-next').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 2 of 3');
  await expect(page.getByTestId('walk-through-caption')).toContainText('Draft an answer');

  const png = await exportStep(page, 'png', 2);
  const pngPath = await png.path();
  expect(pngPath).toBeTruthy();
  expect(readFileSync(pngPath!).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

  const svg = await exportStep(page, 'svg', 2);
  const svgPath = await svg.path();
  const svgText = decodeDownload(svgPath!);
  expect(svgText).toContain('Draft an answer');
  expect(svgText).toContain('<svg');

  const pdf = await exportStep(page, 'pdf', 2);
  const pdfPath = await pdf.path();
  expect(readFileSync(pdfPath!).subarray(0, 5).toString('utf8')).toBe('%PDF-');

  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 2 of 3');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
});

test('typed sequence walks message by message and exports the current step as PNG, SVG, and PDF', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Sequence Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByTestId('board-mode-status')).toHaveText('Sequence');

  await page.getByTestId('toggle-type-messages').click();
  await page.getByTestId('type-messages-input').fill([
    'User asks Agent: plan my trip',
    'Agent tells Search tool: look up flights',
    'Search tool replies Agent: three options',
  ].join('\n'));
  await page.getByTestId('build-messages').click();
  await expect(page.getByTestId('toast-item').filter({ hasText: 'messages' })).toBeVisible();

  const canvas = page.locator('.sequence-canvas');
  await expect(canvas.getByText('look up flights')).toBeVisible();

  await page.getByTestId('walk-through').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('1 · User → Agent: plan my trip');
  await page.getByTestId('walk-through-next').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('2 · Agent → Search tool: look up flights');
  await expect(page.locator('[data-walk-current="true"]')).toContainText('look up flights');
  await expect(page.locator('[data-walk-index="0"]')).toHaveAttribute('opacity', '0.35');

  const png = await exportStep(page, 'png', 2);
  const pngPath = await png.path();
  expect(readFileSync(pngPath!).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

  const svg = await exportStep(page, 'svg', 2);
  const svgText = decodeDownload((await svg.path())!);
  expect(svgText).toContain('look up flights');
  expect(svgText).toContain('0.35');
  expect(svgText).toContain('<svg');

  const pdf = await exportStep(page, 'pdf', 2);
  expect(readFileSync((await pdf.path())!).subarray(0, 5).toString('utf8')).toBe('%PDF-');

  await expect(page.getByTestId('walk-through-caption')).toContainText('2 · Agent → Search tool: look up flights');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
});
