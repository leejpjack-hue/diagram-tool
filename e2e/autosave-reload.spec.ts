import { expect, test, type Page } from '@playwright/test';

// The board write to IndexedDB is debounced by 800ms. A reload inside that
// window must still open the edit from the synchronous localStorage mirror.
test.describe.configure({ timeout: 90_000 });

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
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');

  const editedAt = Date.now();
  await page.evaluate(value => {
    (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
  }, EDITED);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('diagram-tool-pending-board-writes') ?? '';
    return raw.includes('Reload Before Debounce') && raw.includes('at: 80, 340');
  });
  expect(Date.now() - editedAt).toBeLessThan(800);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Reload Before Debounce' }).first().click();
  await waitForEditor(page);
  await expect(page.getByText('title: Reload Before Debounce')).toBeVisible();
  await expect(page.getByText('at: 80, 340')).toBeVisible();
  await expect(page.getByTestId('rf__node-beta')).toBeVisible();
});
