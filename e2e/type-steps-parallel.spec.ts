import { expect, test } from '@playwright/test';

// DT-AI-26: "at the same time" draws a parallel gateway fork and join.
// Two tool branches both land on the join before the next step.
test.describe.configure({ timeout: 90_000 });

const STEPS = [
  'Model: plan',
  'Tool: search docs and at the same time Tool: search tickets',
  'Model: answer',
].join('\n');

test('at the same time builds two parallel gateways and both edges into the join', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(STEPS);
  await page.getByTestId('build-steps').click();

  const toast = page.getByTestId('toast-item').filter({ hasText: 'Built 6 steps' });
  await expect(toast).toContainText('Built 6 steps onto the board · 2 Model · 2 Tool');

  await expect(page.locator('.react-flow__node-gatewayparallel')).toHaveCount(2);
  await expect(page.locator('[data-role-chip="tool"]')).toHaveCount(2);
  await expect(page.locator('.react-flow__node', { hasText: 'search docs' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node', { hasText: 'search tickets' })).toHaveCount(1);

  const edgeIds = await page.locator('.react-flow__edge').evaluateAll(els =>
    els.map(el => el.getAttribute('data-id') ?? ''),
  );
  const intoJoin = edgeIds.filter(id => /_to_join_/.test(id));
  expect(intoJoin).toHaveLength(2);
  expect(intoJoin.some(id => id.includes('search_docs_to_join'))).toBe(true);
  expect(intoJoin.some(id => id.includes('search_tickets_to_join'))).toBe(true);

  await toast.getByTestId('toast-action').click();
  await expect(page.getByTestId('walk-through-overlay')).toBeVisible();
  await page.getByTestId('walk-through-next').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('in parallel');
  await expect(page.getByTestId('walk-through-choose-0')).toContainText('search docs');
  await expect(page.getByTestId('walk-through-choose-1')).toContainText('search tickets');
});
