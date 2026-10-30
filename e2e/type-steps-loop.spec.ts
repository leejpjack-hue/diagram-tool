import { testTimeout } from './testTimeout';
import { expect, test } from '@playwright/test';

// DT-AI-25: "go back to" links an earlier step. Four typed lines stay four
// nodes, the decision points back at "draft reply", and Walk through can
// choose that loop target.
test.describe.configure({ timeout: testTimeout(90_000) });

const STEPS = [
  'Model: draft reply',
  'Check: quality ok?',
  'If no then go back to draft reply',
  'Send',
].join('\n');

test('go back to draft reply builds 4 nodes and walk-through can choose the loop', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(STEPS);
  await page.getByTestId('build-steps').click();

  const toast = page.getByTestId('toast-item').filter({ hasText: 'Built 4 steps' });
  await expect(toast).toContainText('Built 4 steps onto the board · 1 Model · 1 Check');
  await expect(toast).not.toContainText('not found');

  await expect(page.locator('.react-flow__node-flow')).toHaveCount(3);
  await expect(page.locator('.react-flow__node-decision')).toHaveCount(1);
  await expect(page.locator('.react-flow__node', { hasText: 'draft reply' })).toHaveCount(1);

  const edgeIds = await page.locator('.react-flow__edge').evaluateAll(els =>
    els.map(el => el.getAttribute('data-id') ?? ''),
  );
  expect(edgeIds.some(id => id.includes('no_to_draft_reply'))).toBe(true);

  await toast.getByTestId('toast-action').click();
  await expect(page.getByTestId('walk-through-overlay')).toBeVisible();
  await page.getByTestId('walk-through-next').click();
  await page.getByTestId('walk-through-next').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('no');

  await page.getByTestId('walk-through-choose-0').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('draft reply');
});
