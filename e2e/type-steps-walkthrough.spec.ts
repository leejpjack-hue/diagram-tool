import { expect, test } from '@playwright/test';

// DT-AI-16 smoke: Type steps → Build → success toast Walk through → Esc.
test.describe.configure({ timeout: 90_000 });

test('Build success toast Walk through starts and exits the walkthrough', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill('Ask a question\nthen Draft an answer\nthen Send the reply');
  await page.getByTestId('build-steps').click();

  // Success toast keeps its text and gains the Walk through action.
  const toast = page.getByTestId('toast-item').filter({ hasText: 'Built 3 steps' });
  await expect(toast).toHaveCount(1);
  await expect(toast).toContainText('Built 3 steps onto the board');
  await expect(toast.getByTestId('toast-action')).toHaveAccessibleName('Walk through');

  await toast.getByTestId('toast-action').click();
  await expect(page.getByTestId('toast-item')).toHaveCount(0);
  await expect(page.getByTestId('walk-through-overlay')).toBeVisible();
  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 1 of 3');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
});
