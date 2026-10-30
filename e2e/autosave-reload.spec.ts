import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';

// The board write to IndexedDB is debounced by 800ms. A reload inside that
// window must still open the edit from the synchronous localStorage mirror.
test.describe.configure({ timeout: testTimeout(90_000) });

const EDITED = `diagram: flow
title: Reload Before Debounce
direction: TB
Alpha -> Beta
node Alpha {
  label: Alpha
  at: 80, 180
}
node Beta {
  label: Beta
  at: 80, 340
}
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

test('an edit reloaded inside the autosave debounce still opens', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T10:00:00Z') });
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');

  // Hold the 800ms autosave timer while proving the synchronous mirror. Host
  // CPU and protocol latency must not decide whether this test beats a timer.
  await page.clock.pauseAt(new Date('2026-10-30T11:00:00Z'));
  const editedAt = await page.evaluate(() => Date.now());
  await page.evaluate(value => {
    (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
  }, EDITED);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('diagram-tool-pending-board-writes') ?? '';
    return raw.includes('Reload Before Debounce') && raw.includes('at: 80, 340');
  })).toBe(true);
  expect(await page.evaluate(() => Date.now()) - editedAt).toBe(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.clock.resume();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Reload Before Debounce' }).first().click();
  await waitForEditor(page);
  await expect(page.getByText('title: Reload Before Debounce')).toBeVisible();
  await expect(page.getByText('at: 80, 340')).toBeVisible();
  await expect(page.getByTestId('rf__node-beta')).toBeVisible();
});
