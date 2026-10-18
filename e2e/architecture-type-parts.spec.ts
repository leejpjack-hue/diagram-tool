import { expect, test, type Page } from '@playwright/test';

// DT-ARCH-01: Type parts turns plain lines into an architecture board.
test.describe.configure({ timeout: 90_000 });

const LINES = [
  'User -> Chat app: asks',
  'Chat app -> Agent: question',
  'Agent -> Model (AI): prompt',
  'Agent -> Vector DB: search',
  'Agent -> Search tool: web search',
  'inside Cloud: Chat app, Agent, Vector DB',
];

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

test('Type parts builds the example board, flags a garbage line, and refills after reload', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByTestId('toggle-type-steps')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-parts')).toBeVisible();

  await page.getByTestId('toggle-type-parts').click();
  await expect(page.getByTestId('type-parts-handwritten-hint')).toBeVisible();
  await expect(page.getByTestId('type-parts-input')).toHaveValue('');

  const typed = `${LINES.join('\n')}\nthis is not a part`;
  await page.getByTestId('type-parts-input').fill(typed);
  await expect(page.getByTestId('type-parts-preview-warning')).toContainText("wasn't understood");
  await expect(page.getByTestId('type-parts-preview')).toContainText('Vector DB (database)');
  await expect(page.getByTestId('type-parts-preview')).toContainText('"search"');

  await page.getByTestId('build-parts').click();
  await expect(page.getByTestId('toast-item').filter({ hasText: '6 parts, 5 connections' })).toBeVisible();

  await expect(page.locator('.react-flow__node', { hasText: 'Chat app' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Agent' })).toBeVisible();
  await expect(page.locator('.react-flow__node-database', { hasText: 'Vector DB' })).toBeVisible();
  await expect(page.locator('.react-flow__node-groupcontainer', { hasText: 'Cloud' })).toBeVisible();
  await expect(page.locator('.react-flow').getByText('search', { exact: true })).toBeVisible();

  await page.waitForFunction(() => (localStorage.getItem('diagram-tool-pending-board-writes') ?? '').includes('@type-parts'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Untitled Architecture' }).click();
  await waitForEditor(page);

  await page.getByTestId('toggle-type-parts').click();
  const restored = await page.getByTestId('type-parts-input').inputValue();
  for (const line of LINES) expect(restored).toContain(line);
  expect(restored).toContain('this is not a part');
});
