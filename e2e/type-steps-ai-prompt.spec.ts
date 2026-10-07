import { expect, test } from '@playwright/test';

// DT-AI-17 smoke: the Type steps panel shows a keyboard-reachable Copy AI prompt.
test.describe.configure({ timeout: 90_000 });

test('Copy AI prompt button is visible and focusable in Type steps', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();

  const button = page.getByTestId('copy-ai-prompt');
  await expect(button).toBeVisible();
  await button.focus();
  await expect(button).toBeFocused();
});
