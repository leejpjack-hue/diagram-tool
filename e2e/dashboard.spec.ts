import { expect, test } from '@playwright/test';

test.describe('Miro-style personal dashboard', () => {
  test('creates a board, organizes it, searches it, and restores it from Trash', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
    await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Untitled Workflow' })).toBeVisible();

    await page.getByRole('button', { name: 'New Space' }).click();
    await page.getByPlaceholder('New Space name').fill('Platform');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Actions for Untitled Workflow' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Platform workflow');
    await page.getByPlaceholder('architecture, payments, v2').fill('platform, demo');
    await page.locator('[role="dialog"] select').selectOption({ label: 'Platform' });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.getByPlaceholder('Search titles, descriptions, tags, and DSL').fill('demo');
    await expect(page.getByRole('heading', { name: 'Platform workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled Workflow' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Actions for Platform workflow' }).click();
    await page.getByRole('button', { name: 'Move to Trash' }).click();
    await page.getByRole('button', { name: 'Trash 1' }).click();
    await expect(page.getByRole('heading', { name: 'Platform workflow' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions for Platform workflow' }).click();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Trash is empty')).toBeVisible();
  });

  test('keeps the mobile dashboard within the viewport and opens its navigation drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Close navigation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Templates', exact: true })).toBeVisible();
  });

  test('starts from the typed AI workflow on Home, edits text to update canvas, and persists locally without an account (#137)', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    // Home offers the typed AI-workflow starter alongside existing blanks and templates.
    const aiStarter = page.getByTestId('template-card-flow-ai-workflow');
    await expect(aiStarter).toBeVisible();
    await expect(aiStarter).toContainText('AI workflow');
    await expect(page.getByRole('button', { name: /Blank Workflow/i })).toBeVisible();
    await expect(page.getByTestId('template-card-aws-three-tier')).toBeVisible();
    await expect(page.getByTestId('template-card-workshop-retro')).toBeVisible();

    await aiStarter.click();

    // Canvas renders the human / model / tool / check flow and Type steps is pre-filled.
    await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Human ask' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Model' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Tool' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Check' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Reply' })).toBeVisible();

    const stepsInput = page.getByTestId('type-steps-input');
    await expect(stepsInput).toBeVisible();
    await expect(stepsInput).toHaveValue(
      ['Human: Human ask', 'Model: Model', 'Tool: Tool', 'If Check: Check', 'then Human: Reply', 'else go back to Model'].join('\n'),
    );

    // Edit the typed starter steps and watch the canvas update.
    await stepsInput.fill(
      ['Human: Human ask', 'Model: Draft plan', 'Tool: Search docs', 'If Check: Verified?', 'then Human: Reply', 'else go back to Draft plan'].join('\n'),
    );
    await page.getByTestId('build-steps').click();
    await expect(page.locator('.react-flow__node', { hasText: 'Draft plan' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Search docs' })).toBeVisible();

    // Local-first: board stays on the device across reload with no account required.
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI workflow' }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'AI workflow' }).first().click();
    await expect(page.locator('.react-flow__node', { hasText: 'Draft plan' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Search docs' })).toBeVisible();
  });
});
