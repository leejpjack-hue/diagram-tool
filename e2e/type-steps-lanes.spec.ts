import { expect, test, type Locator, type Page } from '@playwright/test';

// DT-AI-27: Lanes by role puts mixed Type steps into Human / AI agent / Tool lanes.
test.describe.configure({ timeout: 90_000 });

const STEPS = [
  'Human: ask',
  'Model: draft',
  'Tool: search',
  'Check: review',
  'Send',
].join('\n');

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

function contains(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 2);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 2);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 2);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 2);
}

function lane(page: Page, name: string) {
  return page.locator('.react-flow__node').filter({
    has: page.locator(`[data-testid="swimlane-label"][data-lane-name="${name}"]`),
  });
}

test('Lanes by role builds Human, AI agent, and Tool lanes around their nodes', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  const lanesToggle = page.getByTestId('type-steps-lanes-by-role');
  await expect(lanesToggle).not.toBeChecked();
  await page.getByTestId('type-steps-input').fill(STEPS);
  await lanesToggle.check();
  await page.getByTestId('build-steps').click();

  await expect(page.getByTestId('toast-item').filter({ hasText: 'Built 5 steps' })).toBeVisible();

  for (const name of ['Human', 'AI agent', 'Tool']) {
    await expect(page.locator(`[data-testid="swimlane-label"][data-lane-name="${name}"]`)).toBeVisible();
  }

  const roles = [
    { nodeId: 'ask', laneName: 'Human' },
    { nodeId: 'draft', laneName: 'AI agent' },
    { nodeId: 'search', laneName: 'Tool' },
  ];
  for (const role of roles) {
    const node = page.locator(`.react-flow__node[data-id="${role.nodeId}"]`);
    await expect(node).toBeVisible();
    contains(await box(node), await box(lane(page, role.laneName)));
  }
});
