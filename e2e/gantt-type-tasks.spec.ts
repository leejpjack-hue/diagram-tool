import { expect, test, type Locator, type Page } from '@playwright/test';

// DT-GANTT-02: Type tasks turns one line per task into a Gantt chart.
// The five example lines are a group, three task bars, and one milestone.
// The group summary is the fourth bar.
test.describe.configure({ timeout: 90_000 });

const LINES = [
  'Phase: Build',
  'Collect data — 3d — Human: Jack',
  'Train model — 5d after Collect data — AI agent',
  'Review — 2d after Train model — Human: May',
  'Go live — milestone after Review',
];

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

function bar(page: Page, name: string): Locator {
  return page.locator(`[data-testid^="gantt-task-bar"][data-task-name="${name}"]`);
}

test('Type tasks builds 4 bars and 1 milestone, flags a bad after name, and refills after reload', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByTestId('toggle-type-steps')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-parts')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-messages')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-tasks')).toBeVisible();

  await page.getByTestId('toggle-type-tasks').click();
  await expect(page.getByTestId('type-tasks-handwritten-hint')).toBeVisible();
  await expect(page.getByTestId('type-tasks-input')).toHaveValue('');

  await page.getByTestId('type-tasks-input').fill(LINES.join('\n'));
  await expect(page.getByTestId('type-tasks-preview')).toContainText('Train model · 5 days · after Collect data · AI agent');
  await expect(page.getByTestId('type-tasks-preview')).toContainText('group Build');

  await page.getByTestId('build-tasks').click();
  await expect(page.getByTestId('toast-item').filter({ hasText: '4 tasks, 1 group' })).toBeVisible();
  await page.waitForFunction(() => (localStorage.getItem('diagram-tool-pending-board-writes') ?? '').includes('@type-tasks'));

  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.locator('[data-gantt-bar="true"]')).toHaveCount(4);
  await expect(page.locator('[data-testid^="gantt-task-bar"]')).toHaveCount(3);
  await expect(page.locator('[data-testid^="gantt-group-bar"][data-task-name="Build"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="gantt-milestone"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="gantt-milestone"][data-task-name="Go live"]')).toHaveCount(1);
  await expect(page.getByTestId('gantt-dependency-line')).toHaveCount(3);
  await expect(page.locator('[data-testid^="gantt-task-row"][data-task-name="Build"]')).toHaveCount(1);
  await expect(bar(page, 'Train model')).toHaveAttribute('data-role', 'ai');
  await expect(bar(page, 'Train model').locator('rect').first()).toHaveAttribute('fill', '#6d28d9');
  await expect(bar(page, 'Collect data')).toHaveAttribute('data-role', 'human');
  await expect(bar(page, 'Review')).toHaveAttribute('data-role', 'human');
  await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);

  await page.getByTestId('type-tasks-input').fill(`${LINES.join('\n')}\nShip — 1d after Train modell`);
  await expect(page.getByTestId('type-tasks-preview-warning')).toContainText('Unknown task "Train modell"');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Untitled Timeline' }).click();
  await waitForEditor(page);

  await page.getByTestId('toggle-type-tasks').click();
  const restored = await page.getByTestId('type-tasks-input').inputValue();
  for (const line of LINES) expect(restored).toContain(line);
  expect(restored).not.toContain('Train modell');
});
