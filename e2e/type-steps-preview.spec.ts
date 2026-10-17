import { expect, test } from '@playwright/test';

// DT-AI-28: the Understood as list warns on a mistyped role, shows a parsed
// role and note, and leaves Build working. The board stays put until Build.
test.describe.configure({ timeout: 90_000 });

const STEPS = ['Humna: ask', 'Model: draft — reuse tickets'].join('\n');

test('Humna warns, Model shows role and note, and Build still works', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(STEPS);

  const preview = page.getByTestId('type-steps-preview');
  await expect(preview.getByText('Did you mean Human:?')).toBeVisible();
  const modelRow = preview.getByTestId('type-steps-preview-row').filter({ hasText: 'draft' });
  await expect(modelRow).toContainText('model');
  await expect(modelRow).toContainText('reuse tickets');
  await expect(preview.getByTestId('type-steps-preview-summary')).toHaveText('2 steps, 1 warning');

  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Start' })).toBeVisible();

  await page.getByTestId('build-steps').click();
  const toast = page.getByTestId('toast-item').filter({ hasText: 'Built 2 steps' });
  await expect(toast).toContainText('Built 2 steps onto the board · 1 Model');
  await expect(page.locator('.react-flow__node', { hasText: 'draft' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Humna: ask' })).toBeVisible();
});
